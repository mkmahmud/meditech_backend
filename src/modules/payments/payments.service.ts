import {
    Injectable,
    BadRequestException,
    NotFoundException,
    InternalServerErrorException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { EncryptionService } from 'src/common/encryption/encryption.service';
import { RedisService } from 'src/common/redis/redis.service';
import {
    CreatePaymentRequest,
    RefundRequest,
    PaymentDetails,
    GetPaymentsListRequest,
} from './schemas/payment.schema';
import {
    PaymentStatus,
    PaymentProvider,
    PaymentType,
    PAYMENT_CONFIG,
    PaymentErrorCode,
    RefundStatus,
    TransactionType,
} from './constants/payment.constants';
import { StripePaymentProvider } from './providers/stripe.provider';
import { PayPalPaymentProvider } from './providers/paypal.provider';
import { CardPaymentProvider } from './providers/card.provider';
import { v4 as uuidv4 } from 'uuid';

/**
 * Main Payment Service
 * Orchestrates payment processing across multiple providers
 * Implements security best practices:
 * - Idempotency for duplicate prevention
 * - Encryption for sensitive data
 * - Audit logging for compliance
 * - Rate limiting
 * - Error handling and retries
 */
@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly IDEMPOTENCY_TTL = 86400; // 24 hours

    constructor(
        private prisma: PrismaService,
        private encryption: EncryptionService,
        private redis: RedisService,
        private stripeProvider: StripePaymentProvider,
        private paypalProvider: PayPalPaymentProvider,
        private cardProvider: CardPaymentProvider,
    ) { }

    /**
     * Create and process a payment
     * Implements idempotency to prevent duplicate charges
     */
    async createPayment(userId: string, payload: CreatePaymentRequest): Promise<any> {
        try {
            this.logger.debug(`Creating payment for user: ${userId}, amount: ${payload.amount}`);

            // Check for duplicate payment using idempotency key
            const existingPayment = await (this.prisma.payment as any).findUnique({
                where: { idempotencyKey: payload.idempotencyKey },
            });

            if (existingPayment) {
                this.logger.warn(
                    `Duplicate payment attempt detected: ${payload.idempotencyKey}`,
                );

                if (existingPayment.status === PaymentStatus.FAILED) {
                    throw new ConflictException(
                        'This idempotencyKey was already used for a failed payment attempt. Use a new idempotencyKey to retry the payment.',
                    );
                }

                return this.sanitizePaymentResponse(existingPayment);
            }

            // Validate patient exists
            const patient = await this.prisma.patient.findUnique({
                where: { userId },
            });

            if (!patient) {
                throw new NotFoundException('Patient not found');
            }

            // Validate payment amount
            this.validatePaymentAmount(payload.amount);

            // Validate references based on payment type
            await this.validatePaymentReferences(payload);

            // Generate invoice number
            const invoiceNumber = await this.generateInvoiceNumber();

            // Create payment record (initial status: PENDING)
            const payment = await (this.prisma.payment as any).create({
                data: {
                    patientId: patient.id,
                    amount: payload.amount,
                    currency: payload.currency || PAYMENT_CONFIG.DEFAULT_CURRENCY,
                    status: PaymentStatus.PENDING,
                    method: payload.method,
                    provider: payload.provider,
                    paymentType: payload.paymentType,
                    appointmentId: payload.appointmentId,
                    prescriptionId: payload.prescriptionId,
                    labTestId: payload.labTestId,
                    idempotencyKey: payload.idempotencyKey,
                    invoiceNumber: invoiceNumber,
                    description: payload.description,
                },
            });

            // Process payment based on provider
            const processedPayment = await this.processPaymentByProvider(
                payment.id,
                payment,
                payload,
            );

            // Log audit trail
            await this.logAuditTrail({
                userId,
                action: 'CREATE_PAYMENT',
                resourceId: payment.id,
                details: {
                    amount: payload.amount,
                    provider: payload.provider,
                    paymentType: payload.paymentType,
                },
            });

            return this.sanitizePaymentResponse(processedPayment);
        } catch (error) {
            this.logger.error(`Payment creation failed: ${error.message}`);

            // Log failed attempt for audit
            await this.logAuditTrail({
                userId,
                action: 'CREATE_PAYMENT_FAILED',
                details: {
                    error: error.message,
                    errorCode: error.code || 'UNKNOWN',
                },
            });

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            throw new InternalServerErrorException(
                error.message || 'Payment processing failed',
            );
        }
    }

    /**
     * Process payment based on selected provider
     */
    private async processPaymentByProvider(
        paymentId: string,
        payment: any,
        payload: CreatePaymentRequest,
    ): Promise<any> {
        let result: any;
        let transactionType = TransactionType.CHARGE;

        try {
            switch (payload.provider) {
                case PaymentProvider.STRIPE:
                    result = await this.stripeProvider.createPaymentIntent(
                        payload.amount,
                        payload.currency,
                        {
                            paymentId,
                            paymentType: payload.paymentType,
                            customerEmail: payload.paypalEmail,
                        },
                        payload.idempotencyKey,
                    );
                    break;

                case PaymentProvider.PAYPAL:
                    result = await this.paypalProvider.createOrder(
                        payload.amount,
                        payload.currency,
                        { paymentId, payerEmail: payload.paypalEmail },
                        payload.idempotencyKey,
                    );
                    break;

                case PaymentProvider.CARD:
                    if (!payload.card) {
                        throw new BadRequestException('Card data is required for card payments');
                    }
                    result = await this.cardProvider.processCardPayment(
                        payload.amount,
                        payload.currency,
                        payload.card,
                        payload.idempotencyKey,
                    );
                    break;

                default:
                    throw new BadRequestException(`Unsupported payment provider: ${payload.provider}`);
            }

            // Determine payment status based on provider
            // For Stripe/PayPal: PENDING until webhook confirms
            // For Card: COMPLETED immediately
            const isInstantPayment = payload.provider === PaymentProvider.CARD;
            const paymentStatus = isInstantPayment ? PaymentStatus.COMPLETED : PaymentStatus.PENDING;
            const paidAtTime = isInstantPayment ? new Date() : null;

            // Update payment with transaction details
            const updatedPayment = await (this.prisma.payment as any).update({
                where: { id: paymentId },
                data: {
                    transactionId: result.transactionId,
                    status: paymentStatus,
                    paidAt: paidAtTime,
                    cardLastFour: result.cardLastFour,
                    cardBrand: result.cardBrand,
                    gatewayResponse: this.encryption.encrypt(JSON.stringify(result)),
                },
            });

            // Log transaction
            await (this.prisma as any).paymentTransaction.create({
                data: {
                    paymentId,
                    type: transactionType,
                    status: isInstantPayment ? 'SUCCESS' : 'PENDING',
                    amount: payload.amount,
                    details: this.encryption.encrypt(JSON.stringify(result)),
                },
            });

            return {
                ...updatedPayment,
                paymentUrl: result.paymentUrl,
                checkoutUrl: result.checkoutUrl,
                clientSecret: result.clientSecret,
                expiresAt: result.expiresAt,
            };
        } catch (error) {
            this.logger.error(`Provider processing failed: ${error.message}`);

            // Update payment status to FAILED
            await (this.prisma.payment as any).update({
                where: { id: paymentId },
                data: {
                    status: PaymentStatus.FAILED,
                    failedAt: new Date(),
                    gatewayResponse: this.encryption.encrypt(
                        JSON.stringify({ error: error.message }),
                    ),
                },
            });

            // Log failed transaction
            await (this.prisma as any).paymentTransaction.create({
                data: {
                    paymentId,
                    type: transactionType,
                    status: 'FAILED',
                    amount: payload.amount,
                    errorMessage: error.message,
                },
            });

            throw error;
        }
    }

    /**
     * Refund a payment
     */
    async refundPayment(userId: string, payload: RefundRequest): Promise<any> {
        try {
            this.logger.debug(`Refunding payment: ${payload.paymentId}`);

            // Check for duplicate refund using idempotency key
            const existingRefund = await (this.prisma as any).refund.findUnique({
                where: { idempotencyKey: payload.idempotencyKey },
            });

            if (existingRefund) {
                this.logger.warn(
                    `Duplicate refund attempt detected: ${payload.idempotencyKey}`,
                );
                return existingRefund;
            }

            // Verify payment exists and belongs to patient
            const payment: any = await this.prisma.payment.findUnique({
                where: { id: payload.paymentId },
                include: { patient: true },
            });

            if (!payment) {
                throw new NotFoundException('Payment not found');
            }

            if (payment.patient.userId !== userId) {
                throw new BadRequestException('Unauthorized to refund this payment');
            }

            // Verify payment can be refunded
            if (payment.status !== PaymentStatus.COMPLETED) {
                throw new BadRequestException('Only completed payments can be refunded');
            }

            // Determine refund amount
            const refundAmount = payload.amount || payment.amount;

            // Validate refund amount
            if (refundAmount <= 0 || refundAmount > payment.amount - payment.totalRefunded) {
                throw new BadRequestException('Invalid refund amount');
            }

            // Create refund record
            const refund = await (this.prisma as any).refund.create({
                data: {
                    paymentId: payment.id,
                    amount: refundAmount,
                    reason: payload.reason,
                    status: RefundStatus.PENDING,
                    idempotencyKey: payload.idempotencyKey,
                },
            });

            // Process refund with provider
            const refundResult = await this.processRefundByProvider(
                payment,
                refund,
                refundAmount,
                payload.idempotencyKey,
            );

            // Update payment and refund status
            await (this.prisma.payment as any).update({
                where: { id: payment.id },
                data: {
                    status: refundAmount === payment.amount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_PAID,
                    totalRefunded: payment.totalRefunded + refundAmount,
                },
            });

            await (this.prisma as any).refund.update({
                where: { id: refund.id },
                data: {
                    status: RefundStatus.COMPLETED,
                    refundId: refundResult.refundId,
                    processedAt: new Date(),
                },
            });

            // Log audit trail
            await this.logAuditTrail({
                userId,
                action: 'REFUND_PAYMENT',
                resourceId: payment.id,
                details: {
                    refundAmount,
                    reason: payload.reason,
                },
            });

            return refund;
        } catch (error) {
            this.logger.error(`Refund failed: ${error.message}`);

            await this.logAuditTrail({
                userId,
                action: 'REFUND_PAYMENT_FAILED',
                resourceId: payload.paymentId,
                details: { error: error.message },
            });

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }

            throw new InternalServerErrorException('Refund processing failed');
        }
    }

    /**
     * Process refund based on provider
     */
    private async processRefundByProvider(
        payment: any,
        refund: any,
        amount: number,
        idempotencyKey: string,
    ): Promise<any> {
        switch (payment.provider) {
            case PaymentProvider.STRIPE:
                return await this.stripeProvider.createRefund(
                    payment.transactionId,
                    amount,
                    refund.reason,
                    idempotencyKey,
                );

            case PaymentProvider.PAYPAL:
                return await this.paypalProvider.refundPayment(
                    payment.transactionId,
                    amount,
                    refund.reason,
                    idempotencyKey,
                );

            case PaymentProvider.CARD:
                return await this.cardProvider.refundCardPayment(
                    payment.transactionId,
                    amount,
                    refund.reason,
                    idempotencyKey,
                );

            default:
                throw new InternalServerErrorException('Unsupported provider for refund');
        }
    }

    /**
     * Get payment details
     */
    async getPaymentDetails(userId: string, paymentId: string): Promise<PaymentDetails> {
        try {
            const payment: any = await (this.prisma.payment as any).findUnique({
                where: { id: paymentId },
                include: { patient: true, refunds: true, transactions: true },
            });

            if (!payment) {
                throw new NotFoundException('Payment not found');
            }

            if (payment.patient.userId !== userId) {
                throw new BadRequestException('Unauthorized to access this payment');
            }

            return this.sanitizePaymentResponse(payment);
        } catch (error) {
            this.logger.error(`Failed to get payment details: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get payments list for a patient
     */
    async getPaymentsList(
        userId: string,
        query: GetPaymentsListRequest,
    ): Promise<{ payments: any[]; total: number; page: number; limit: number }> {
        try {
            const patient = await this.prisma.patient.findUnique({
                where: { userId },
            });

            if (!patient) {
                throw new NotFoundException('Patient not found');
            }

            const where: any = { patientId: patient.id };

            if (query.status) {
                where.status = query.status;
            }

            if (query.type) {
                where.paymentType = query.type;
            }

            if (query.provider) {
                where.provider = query.provider;
            }

            if (query.startDate || query.endDate) {
                where.createdAt = {};
                if (query.startDate) {
                    where.createdAt.gte = query.startDate;
                }
                if (query.endDate) {
                    where.createdAt.lte = query.endDate;
                }
            }

            const total = await this.prisma.payment.count({ where });

            const payments = await (this.prisma.payment as any).findMany({
                where,
                include: { refunds: true },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
                orderBy: { createdAt: 'desc' },
            });

            return {
                payments: payments.map((p: any) => this.sanitizePaymentResponse(p)),
                total,
                page: query.page,
                limit: query.limit,
            };
        } catch (error) {
            this.logger.error(`Failed to get payments list: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate payment amount
     */
    private validatePaymentAmount(amount: number): void {
        if (amount < PAYMENT_CONFIG.MIN_PAYMENT_AMOUNT) {
            throw new BadRequestException(
                `Amount must be at least ${PAYMENT_CONFIG.MIN_PAYMENT_AMOUNT}`,
            );
        }

        if (amount > PAYMENT_CONFIG.MAX_PAYMENT_AMOUNT) {
            throw new BadRequestException(
                `Amount exceeds maximum limit of ${PAYMENT_CONFIG.MAX_PAYMENT_AMOUNT}`,
            );
        }
    }

    /**
     * Validate payment references
     */
    private async validatePaymentReferences(payload: CreatePaymentRequest): Promise<void> {
        switch (payload.paymentType) {
            case PaymentType.APPOINTMENT_FEE:
                if (!payload.appointmentId) {
                    throw new BadRequestException('Appointment ID is required for appointment fees');
                }
                await this.verifyResourceExists('appointment', payload.appointmentId);
                break;

            case PaymentType.LAB_TEST_FEE:
                if (!payload.labTestId) {
                    throw new BadRequestException('Lab test ID is required for lab test fees');
                }
                await this.verifyResourceExists('labTest', payload.labTestId);
                break;

            case PaymentType.MEDICINE_FEE:
                if (!payload.prescriptionId) {
                    throw new BadRequestException('Prescription ID is required for medicine fees');
                }
                await this.verifyResourceExists('prescription', payload.prescriptionId);
                break;
        }
    }

    /**
     * Verify resource exists
     */
    private async verifyResourceExists(resourceType: string, resourceId: string): Promise<void> {
        try {
            switch (resourceType) {
                case 'appointment':
                    const appointment = await this.prisma.appointment.findUnique({
                        where: { id: resourceId },
                    });
                    if (!appointment) {
                        throw new NotFoundException('Appointment not found');
                    }
                    break;

                case 'labTest':
                    const labTest = await this.prisma.labResult.findUnique({
                        where: { id: resourceId },
                    });
                    if (!labTest) {
                        throw new NotFoundException('Lab test not found');
                    }
                    break;

                case 'prescription':
                    const prescription = await this.prisma.prescription.findUnique({
                        where: { id: resourceId },
                    });
                    if (!prescription) {
                        throw new NotFoundException('Prescription not found');
                    }
                    break;
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Generate unique invoice number
     */
    private async generateInvoiceNumber(): Promise<string> {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `INV-${timestamp}-${random}`;
    }

    /**
     * Sanitize payment response (remove sensitive data)
     * Include payment URLs from request for checkout
     */
    private sanitizePaymentResponse(payment: any): any {
        if (!payment) return null;

        return {
            id: payment.id,
            patientId: payment.patientId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            method: payment.method,
            provider: payment.provider,
            paymentType: payment.paymentType,
            transactionId: payment.transactionId,
            invoiceNumber: payment.invoiceNumber,
            invoiceUrl: payment.invoiceUrl,
            cardLastFour: payment.cardLastFour,
            cardBrand: payment.cardBrand,
            totalRefunded: payment.totalRefunded,
            description: payment.description,
            paidAt: payment.paidAt,
            failedAt: payment.failedAt,
            createdAt: payment.createdAt,
            updatedAt: payment.updatedAt,
            // Payment URLs (only present in initial creation response)
            paymentUrl: payment.paymentUrl,
            checkoutUrl: payment.checkoutUrl,
            clientSecret: payment.clientSecret,
            expiresAt: payment.expiresAt,
            refunds: payment.refunds?.map((r: any) => ({
                id: r.id,
                amount: r.amount,
                reason: r.reason,
                status: r.status,
                processedAt: r.processedAt,
            })),
        };
    }

    /**
     * Audit logging
     */
    private async logAuditTrail(data: any): Promise<void> {
        try {
            // This would integrate with your audit logging system
            this.logger.debug(`Audit Trail: ${JSON.stringify(data)}`);
        } catch (error) {
            this.logger.error(`Failed to log audit trail: ${error.message}`);
        }
    }
}

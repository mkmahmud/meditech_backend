import {
    Controller,
    Post,
    Get,
    Param,
    Body,
    UseGuards,
    UseFilters,
    UsePipes,
    Query,
    HttpStatus,
    HttpCode,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import {
    CreatePaymentRequestSchema,
    RefundRequestSchema,
    GetPaymentsListSchema,
} from './schemas/payment.schema';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/auth.decorator';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { PAYMENT_CONFIG, PaymentProvider } from './constants/payment.constants';

/**
 * Payments Controller
 * Handles payment endpoints with proper security:
 * - JWT authentication
 * - Rate limiting
 * - Comprehensive error handling
 * - Audit logging
 */
@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(private paymentsService: PaymentsService) { }

    /**
     * Create a new payment
     * Rate-limited to prevent abuse
     */
    @Post('create')
    @HttpCode(HttpStatus.CREATED)
    @Throttle({ default: { limit: PAYMENT_CONFIG.MAX_PAYMENTS_PER_MINUTE, ttl: PAYMENT_CONFIG.RATE_LIMIT_WINDOW_MS } })
    @UsePipes(new ZodValidationPipe(CreatePaymentRequestSchema))
    @Roles('PATIENT')
    @ApiOperation({
        summary: 'Create a new payment',
        description: 'Initiates a payment for appointment fees, lab tests, or medicines',
    })
    @ApiResponse({
        status: 201,
        description: 'Payment created successfully',
        schema: {
            example: {
                id: 'uuid',
                patientId: 'uuid',
                amount: 99.99,
                currency: 'USD',
                status: 'COMPLETED',
                provider: 'STRIPE',
                paymentType: 'APPOINTMENT_FEE',
                invoiceNumber: 'INV-1234567890-ABC',
                cardLastFour: '****4242',
                cardBrand: 'VISA',
                paidAt: '2026-03-10T10:30:00Z',
                createdAt: '2026-03-10T10:30:00Z',
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad request - invalid payment data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 429, description: 'Too many requests - rate limit exceeded' })
    async createPayment(
        @CurrentUser() user: any,
        @Body() payload: any,
    ) {
        try {
            this.logger.log(
                `Payment creation requested by user: ${user.id}, amount: ${payload.amount}`,
            );

            const payment = await this.paymentsService.createPayment(user.id, payload);
            const message = payment.status === 'FAILED'
                ? PAYMENT_CONFIG.MESSAGES.PAYMENT_FAILED
                : payment.status === 'PENDING'
                    ? PAYMENT_CONFIG.MESSAGES.PAYMENT_PENDING
                    : PAYMENT_CONFIG.MESSAGES.PAYMENT_SUCCESS;

            return {
                statusCode: HttpStatus.CREATED,
                message,
                data: payment,
            };
        } catch (error) {
            this.logger.error(`Payment creation error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get payment details
     */
    @Get(':paymentId')
    @Roles('PATIENT')
    @ApiOperation({
        summary: 'Get payment details',
        description: 'Retrieve details of a specific payment by ID',
    })
    @ApiResponse({
        status: 200,
        description: 'Payment details retrieved successfully',
    })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getPaymentDetails(
        @CurrentUser() user: any,
        @Param('paymentId') paymentId: string,
    ) {
        try {
            this.logger.log(`Fetching payment: ${paymentId} for user: ${user.id}`);

            const payment = await this.paymentsService.getPaymentDetails(user.id, paymentId);

            return {
                statusCode: HttpStatus.OK,
                data: payment,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch payment details: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get payments list
     */
    @Get()
    @Roles('PATIENT')
    @ApiOperation({
        summary: 'Get payments list',
        description: 'Retrieve a paginated list of payments for the current patient',
    })
    @ApiResponse({
        status: 200,
        description: 'Payments list retrieved successfully',
        schema: {
            example: {
                payments: [],
                total: 0,
                page: 1,
                limit: 20,
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async getPaymentsList(
        @CurrentUser() user: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('type') type?: string,
        @Query('provider') provider?: string,
    ) {
        try {
            this.logger.log(`Fetching payments list for user: ${user.id}`);

            const query = {
                page: page ? parseInt(page, 10) : 1,
                limit: limit ? parseInt(limit, 10) : 20,
                status,
                type,
                provider,
            };

            const result = await this.paymentsService.getPaymentsList(user.id, query);

            return {
                statusCode: HttpStatus.OK,
                data: result,
            };
        } catch (error) {
            this.logger.error(`Failed to fetch payments list: ${error.message}`);
            throw error;
        }
    }

    /**
     * Refund a payment
     */
    @Post(':paymentId/refund')
    @HttpCode(HttpStatus.OK)
    @Throttle({ default: { limit: 5, ttl: PAYMENT_CONFIG.RATE_LIMIT_WINDOW_MS } })
    @UsePipes(new ZodValidationPipe(RefundRequestSchema))
    @Roles('PATIENT')
    @ApiOperation({
        summary: 'Refund a payment',
        description: 'Request a full or partial refund for a completed payment',
    })
    @ApiResponse({
        status: 200,
        description: 'Refund initiated successfully',
        schema: {
            example: {
                id: 'uuid',
                paymentId: 'uuid',
                amount: 99.99,
                reason: 'Changed mind about appointment',
                status: 'COMPLETED',
                processedAt: '2026-03-10T10:35:00Z',
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Bad request - invalid refund data' })
    @ApiResponse({ status: 404, description: 'Payment not found' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async refundPayment(
        @CurrentUser() user: any,
        @Param('paymentId') paymentId: string,
        @Body() payload: any,
    ) {
        try {
            this.logger.log(
                `Refund requested for payment: ${paymentId} by user: ${user.id}`,
            );

            // Ensure payment ID in URL matches body
            const refundPayload = {
                ...payload,
                paymentId,
            };

            const refund = await this.paymentsService.refundPayment(user.id, refundPayload);

            return {
                statusCode: HttpStatus.OK,
                message: PAYMENT_CONFIG.MESSAGES.REFUND_INITIATED,
                data: refund,
            };
        } catch (error) {
            this.logger.error(`Refund request error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Health check endpoint
     */
    @Get('health/check')
    @HttpCode(HttpStatus.OK)
    healthCheck() {
        return {
            statusCode: HttpStatus.OK,
            message: 'Payments service is healthy',
            timestamp: new Date().toISOString(),
        };
    }
}

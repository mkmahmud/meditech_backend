import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    PAYMENT_CONFIG,
    PaymentErrorCode,
    PaymentStatus,
    TransactionType,
} from '../constants/payment.constants';

interface PaymentIntentData {
    transactionId: string;
    status: string;
    amount: number;
    currency: string;
    metadata: Record<string, unknown>;
}

interface RefundData {
    refundId: string;
    status: string;
    amount: number;
}

/**
 * Stripe Payment Provider Service
 * Handles payment processing through Stripe API
 * Implements PCI-DSS compliance by not storing full card numbers
 * 
 * Setup:
 * 1. Install stripe: npm install stripe
 * 2. Set env vars:
 *    - STRIPE_API_KEY=sk_test_xxxxx (secret key)
 *    - STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx (public key)
 *    - STRIPE_WEBHOOK_SECRET=whsec_xxxxx
 * 3. Set webhook URL in Stripe Dashboard to: https://yourdomain.com/api/payments/webhooks/stripe
 */
@Injectable()
export class StripePaymentProvider {
    private readonly logger = new Logger(StripePaymentProvider.name);
    private stripe: any;
    private publishableKey?: string;
    private webhookSecret?: string;

    constructor(private configService: ConfigService) {
        this.initializeStripe();
    }

    /**
     * Initialize Stripe SDK with API key
     */
    private initializeStripe() {
        try {
            const stripeApiKey = this.configService.get('STRIPE_API_KEY');
            this.publishableKey = this.configService.get('STRIPE_PUBLISHABLE_KEY');
            this.webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');

            if (!stripeApiKey) {
                this.logger.warn('STRIPE_API_KEY not configured - Stripe payment processing will be mocked');
                return;
            }

            // Install stripe SDK: npm install stripe
            try {
                const Stripe = require('stripe');
                this.stripe = new Stripe(stripeApiKey, { apiVersion: '2024-04-10' });
                this.logger.log('Stripe SDK initialized successfully');
            } catch (e) {
                this.logger.warn('Stripe SDK not found - install with: npm install stripe');
            }
        } catch (error) {
            this.logger.error('Failed to initialize Stripe', error);
        }
    }

    /**
     * Create a payment intent for Stripe
     * Returns checkout session URL for client to complete payment
     * Idempotency is handled by Stripe using idempotency key
     */
    async createPaymentIntent(
        amount: number,
        currency: string,
        paymentData: any,
        idempotencyKey: string,
    ): Promise<any> {
        try {
            this.logger.debug(`Creating Stripe payment intent: amount=${amount}, currency=${currency}`);

            // Validate amount
            if (amount < PAYMENT_CONFIG.MIN_PAYMENT_AMOUNT) {
                throw new Error(`Amount must be at least ${PAYMENT_CONFIG.MIN_PAYMENT_AMOUNT}`);
            }

            if (amount > PAYMENT_CONFIG.MAX_PAYMENT_AMOUNT) {
                throw new Error(`Amount exceeds maximum limit of ${PAYMENT_CONFIG.MAX_PAYMENT_AMOUNT}`);
            }

            // If Stripe SDK not available, return mock with instructions
            if (!this.stripe) {
                this.logger.warn('Using mock Stripe response - install stripe and configure keys');
                return {
                    transactionId: `cs_test_${this.generateRandomId()}`,
                    status: 'requires_payment_method',
                    amount,
                    currency,
                    clientSecret: null,
                    checkoutUrl: 'https://stripe.com/docs/payments/checkout',
                    paymentUrl: 'https://stripe.com/docs/payments/checkout',
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    metadata: paymentData,
                    isTest: true,
                };
            }

            // Convert amount to cents for Stripe
            const amountInCents = Math.round(amount * 100);
            const appUrl = this.configService.get('APP_URL') || 'http://localhost:3000';

            // Create Checkout Session (recommended for web)
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: currency.toLowerCase(),
                            product_data: {
                                name: paymentData.paymentType || 'Medical Payment',
                                description: `Payment ID: ${paymentData.paymentId}`,
                            },
                            unit_amount: amountInCents,
                        },
                        quantity: 1,
                    },
                ],
                success_url: `${appUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${appUrl}/payments/cancelled`,
                customer_email: paymentData.customerEmail,
                metadata: {
                    paymentId: paymentData.paymentId,
                    paymentType: paymentData.paymentType,
                },
            }, {
                idempotencyKey: `checkout:${idempotencyKey}`,
            });

            this.logger.log(`Stripe checkout session created: ${session.id}`);

            return {
                transactionId: session.id,
                paymentIntentId: session.payment_intent ?? null,
                clientSecret: null,
                checkoutUrl: session.url,
                paymentUrl: session.url,
                expiresAt: session.expires_at
                    ? new Date(session.expires_at * 1000).toISOString()
                    : null,
                status: 'requires_payment_method',
                amount,
                currency,
                metadata: paymentData,
                isTest: false,
            };
        } catch (error) {
            this.logger.error(`Stripe payment intent creation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process a payment with Stripe
     */
    async processPayment(
        paymentIntentId: string,
        cardData: any,
        idempotencyKey: string,
    ): Promise<PaymentIntentData> {
        try {
            this.logger.debug(`Processing Stripe payment: intendId=${paymentIntentId}`);

            // In production:
            // const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
            //   payment_method: {
            //     type: 'card',
            //     card: {
            //       number: cardData.cardNumber,
            //       exp_month: cardData.expiryMonth,
            //       exp_year: cardData.expiryYear,
            //       cvc: cardData.cvv,
            //     },
            //   },
            // }, {
            //   idempotencyKey,
            // });

            // Mock successful response
            return {
                transactionId: paymentIntentId,
                status: 'succeeded',
                amount: cardData.amount,
                currency: cardData.currency,
                metadata: cardData,
            };
        } catch (error) {
            this.logger.error(`Stripe payment processing failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Retrieve payment intent details
     */
    async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntentData> {
        try {
            this.logger.debug(`Retrieving Stripe payment intent: ${paymentIntentId}`);

            // In production:
            // const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

            // Mock response
            return {
                transactionId: paymentIntentId,
                status: 'succeeded',
                amount: 100,
                currency: 'USD',
                metadata: {},
            };
        } catch (error) {
            this.logger.error(`Failed to retrieve Stripe payment intent: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create a refund for a charge
     */
    async createRefund(
        chargeId: string,
        amount: number,
        reason: string,
        idempotencyKey: string,
    ): Promise<RefundData> {
        try {
            this.logger.debug(
                `Creating Stripe refund: chargeId=${chargeId}, amount=${amount}, reason=${reason}`,
            );

            // Validate amount
            if (amount < PAYMENT_CONFIG.MIN_PAYMENT_AMOUNT) {
                throw new Error('Refund amount must be greater than 0');
            }

            // In production:
            // const refund = await this.stripe.refunds.create({
            //   charge: chargeId,
            //   amount: Math.round(amount * 100),
            //   reason: reason as any,
            //   metadata: {
            //     reason: reason,
            //   },
            // }, {
            //   idempotencyKey,
            // });

            // Mock response
            return {
                refundId: `re_${this.generateRandomId()}`,
                status: 'succeeded',
                amount: amount,
            };
        } catch (error) {
            this.logger.error(`Stripe refund creation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get refund status
     */
    async getRefundStatus(refundId: string): Promise<RefundData> {
        try {
            this.logger.debug(`Retrieving Stripe refund status: ${refundId}`);

            // In production:
            // const refund = await this.stripe.refunds.retrieve(refundId);

            // Mock response
            return {
                refundId: refundId,
                status: 'succeeded',
                amount: 100,
            };
        } catch (error) {
            this.logger.error(`Failed to retrieve Stripe refund status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify webhook signature from Stripe
     * Requires raw body (not parsed JSON) for signature verification
     */
    verifyWebhookSignature(rawBody: string, signature: string): boolean {
        try {
            if (!this.stripe) {
                this.logger.warn('Stripe SDK not available - skipping webhook verification');
                return true;
            }

            const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
            if (!webhookSecret) {
                this.logger.warn('STRIPE_WEBHOOK_SECRET not configured - skipping webhook verification');
                return true;
            }

            // Verify signature using raw body
            const event = this.stripe.webhooks.constructEvent(
                rawBody,
                signature,
                webhookSecret,
            );

            return event != null;
        } catch (error: any) {
            this.logger.error(`Stripe webhook verification failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Handle webhook events from Stripe
     * Supports both payment_intent and checkout.session events
     */
    handleWebhookEvent(event: any): any {
        try {
            this.logger.debug(`Handling Stripe webhook event: ${event.type}`);

            switch (event.type) {
                // Payment Intent succeeded (direct API usage)
                case 'payment_intent.succeeded':
                    return {
                        type: 'payment_success',
                        transactionId: event.data.object.id,
                        status: 'succeeded',
                        amount: event.data.object.amount / 100, // Convert from cents
                        metadata: event.data.object.metadata,
                    };

                // Checkout session completed (recommended flow)
                case 'checkout.session.completed':
                    return {
                        type: 'payment_success',
                        transactionId: event.data.object.id,
                        checkoutSessionId: event.data.object.id,
                        status: 'completed',
                        amount: event.data.object.amount_total / 100, // Convert from cents
                        customerEmail: event.data.object.customer_email,
                        metadata: event.data.object.metadata,
                        paymentIntentId: event.data.object.payment_intent,
                    };

                // Payment failed
                case 'payment_intent.payment_failed':
                    return {
                        type: 'payment_failed',
                        transactionId: event.data.object.id,
                        status: 'failed',
                        error: event.data.object.last_payment_error?.message,
                    };

                // Charge refunded
                case 'charge.refunded':
                    return {
                        type: 'refund_completed',
                        transactionId: event.data.object.id,
                        refundAmount: event.data.object.amount_refunded / 100, // Convert from cents
                    };

                default:
                    this.logger.warn(`Unhandled Stripe event type: ${event.type}`);
                    return null;
            }
        } catch (error) {
            this.logger.error(`Stripe webhook handling failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Mask card number for storage (PCI-DSS compliance)
     */
    maskCardNumber(cardNumber: string): string {
        const lastFour = cardNumber.slice(-4);
        return `****-****-****-${lastFour}`;
    }

    /**
     * Extract card brand from card number
     */
    getCardBrand(cardNumber: string): string {
        const patterns = {
            VISA: /^4[0-9]{12}(?:[0-9]{3})?$/,
            MASTERCARD: /^5[1-5][0-9]{14}$/,
            AMEX: /^3[47][0-9]{13}$/,
            DISCOVER: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
        };

        for (const [brand, pattern] of Object.entries(patterns)) {
            if (pattern.test(cardNumber.replace(/\s+/g, ''))) {
                return brand;
            }
        }

        return 'UNKNOWN';
    }

    /**
     * Helper to generate random ID (mock)
     */
    private generateRandomId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}

import { z } from 'zod';
import { PaymentType, PaymentProvider, PaymentMethod } from '../constants/payment.constants';

// Card validation schema
const CardSchema = z.object({
    cardNumber: z
        .string()
        .min(13)
        .max(19)
        .regex(/^[0-9]+$/, 'Card number must contain only digits'),
    cardholderName: z.string().min(2).max(100),
    expiryMonth: z.number().min(1).max(12),
    expiryYear: z.number().min(new Date().getFullYear()),
    cvv: z.string().regex(/^[0-9]{3,4}$/, 'CVV must be 3 or 4 digits'),
});

export type Card = z.infer<typeof CardSchema>;

// Create payment request schema
export const CreatePaymentRequestSchema = z.object({
    amount: z
        .number()
        .positive('Amount must be greater than 0')
        .max(999999.99, 'Amount exceeds maximum limit'),

    currency: z.string().length(3).default('USD'),

    paymentType: z.nativeEnum(PaymentType),

    provider: z
        .nativeEnum(PaymentProvider)
        .refine(p => p !== PaymentProvider.BANK_TRANSFER, {
            message: 'Bank transfer must be initiated separately',
        }),

    method: z.nativeEnum(PaymentMethod),

    // References
    appointmentId: z.string().uuid().optional(),
    prescriptionId: z.string().uuid().optional(),
    labTestId: z.string().uuid().optional(),

    // Card data (optional, for card payments)
    card: CardSchema.optional(),

    // PayPal data (optional)
    paypalEmail: z.string().email().optional(),

    // Description
    description: z.string().max(500).optional(),

    // Idempotency key for preventing duplicate charges
    idempotencyKey: z
        .string()
        .uuid()
        .describe('Unique key to prevent duplicate payments'),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;

// Process payment schema
export const ProcessPaymentSchema = z.object({
    paymentId: z.string().uuid(),
    card: CardSchema.optional(),
    paypalToken: z.string().optional(),
});

export type ProcessPaymentRequestType = z.infer<typeof ProcessPaymentSchema>;

// Refund request schema
export const RefundRequestSchema = z.object({
    paymentId: z.string().uuid(),

    amount: z
        .number()
        .positive('Refund amount must be greater than 0')
        .optional()
        .describe('If not provided, full payment amount will be refunded'),

    reason: z
        .string()
        .min(10)
        .max(500)
        .describe('Reason for refund'),

    idempotencyKey: z
        .string()
        .uuid()
        .describe('Unique key to prevent duplicate refunds'),
});

export type RefundRequest = z.infer<typeof RefundRequestSchema>;

// Payment webhook schema (for provider callbacks)
export const StripeWebhookSchema = z.object({
    type: z.string(),
    data: z.object({
        object: z.object({
            id: z.string(), // transaction ID
            amount: z.number(),
            currency: z.string(),
            status: z.string(),
            metadata: z.record(z.string()).optional(),
        }),
    }),
});

export const PayPalWebhookSchema = z.object({
    id: z.string(),
    event_type: z.string(),
    resource: z.object({
        id: z.string(),
        status: z.string(),
        amount: z.object({
            value: z.string(),
            currency_code: z.string(),
        }),
        supplementary_data: z.record(z.unknown()).optional(),
    }),
});

// Payment details response schema
export const PaymentDetailsSchema = z.object({
    id: z.string().uuid(),
    patientId: z.string().uuid(),
    amount: z.number(),
    currency: z.string(),
    status: z.string(),
    method: z.string(),
    provider: z.string(),
    paymentType: z.string(),
    invoiceNumber: z.string(),
    invoiceUrl: z.string().url().optional(),
    cardLastFour: z.string().optional(),
    cardBrand: z.string().optional(),
    transactionId: z.string().optional(),
    totalRefunded: z.number(),
    description: z.string().optional(),
    paidAt: z.date().optional(),
    failedAt: z.date().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
});

export type PaymentDetails = z.infer<typeof PaymentDetailsSchema>;

// Query payment schema
export const QueryPaymentSchema = z.object({
    paymentId: z.string().uuid(),
});

export type QueryPaymentRequest = z.infer<typeof QueryPaymentSchema>;

// Get payments list schema
export const GetPaymentsListSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().min(1).max(100).default(20),
    status: z.string().optional(),
    type: z.string().optional(),
    provider: z.string().optional(),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
});

export type GetPaymentsListRequest = z.infer<typeof GetPaymentsListSchema>;

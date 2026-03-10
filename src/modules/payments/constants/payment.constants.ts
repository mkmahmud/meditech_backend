// Payment Types
export enum PaymentType {
    APPOINTMENT_FEE = 'APPOINTMENT_FEE',
    LAB_TEST_FEE = 'LAB_TEST_FEE',
    MEDICINE_FEE = 'MEDICINE_FEE',
    CONSULTATION_FEE = 'CONSULTATION_FEE',
    PROCEDURE_FEE = 'PROCEDURE_FEE',
    OTHER = 'OTHER',
}

// Payment Providers
export enum PaymentProvider {
    STRIPE = 'STRIPE',
    PAYPAL = 'PAYPAL',
    CARD = 'CARD',
    BANK_TRANSFER = 'BANK_TRANSFER',
}

// Payment Status
export enum PaymentStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
    PARTIALLY_PAID = 'PARTIALLY_PAID',
    CANCELLED = 'CANCELLED',
}

// Refund Status
export enum RefundStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REJECTED = 'REJECTED',
}

// Payment Method
export enum PaymentMethod {
    CASH = 'CASH',
    CARD = 'CARD',
    INSURANCE = 'INSURANCE',
    ONLINE = 'ONLINE',
    BANK_TRANSFER = 'BANK_TRANSFER',
}

// Configuration
export const PAYMENT_CONFIG = {
    // Currency
    DEFAULT_CURRENCY: 'USD',

    // Timeout
    PAYMENT_TIMEOUT_MS: 30000, // 30 seconds
    WEBHOOK_TIMEOUT_MS: 15000, // 15 seconds

    // Limits
    MIN_PAYMENT_AMOUNT: 0.01,
    MAX_PAYMENT_AMOUNT: 999999.99,
    MAX_REFUND_PERCENTAGE: 100,

    // Retry Policy
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
    RETRY_BACKOFF_MULTIPLIER: 2,

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
    MAX_PAYMENTS_PER_MINUTE: 10,

    // Stripe Config
    STRIPE: {
        API_VERSION: '2023-10-16',
        TIMEOUT_MS: 30000,
    },

    // PayPal Config
    PAYPAL: {
        SANDBOX_MODE: process.env.NODE_ENV !== 'production',
        TIMEOUT_MS: 30000,
    },

    // PCI-DSS Compliance
    PCI_DSS: {
        NEVER_STORE_FULL_CARD: true,
        MIN_CARD_DIGITS_TO_MASK: 12,
        ENCRYPT_SENSITIVE_DATA: true,
    },

    // Messages
    MESSAGES: {
        PAYMENT_SUCCESS: 'Payment processed successfully',
        PAYMENT_FAILED: 'Payment processing failed',
        PAYMENT_PENDING: 'Payment is pending',
        REFUND_INITIATED: 'Refund has been initiated',
        DUPLICATE_PAYMENT: 'Duplicate payment detected',
        IDEMPOTENCY_MISMATCH: 'Idempotency key mismatch',
    },
};

// Error Codes
export enum PaymentErrorCode {
    INVALID_AMOUNT = 'INVALID_AMOUNT',
    INVALID_CURRENCY = 'INVALID_CURRENCY',
    PAYMENT_TIMEOUT = 'PAYMENT_TIMEOUT',
    PAYMENT_DECLINED = 'PAYMENT_DECLINED',
    DUPLICATE_REQUEST = 'DUPLICATE_REQUEST',
    PROVIDER_ERROR = 'PROVIDER_ERROR',
    AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    INVALID_PAYMENT_METHOD = 'INVALID_PAYMENT_METHOD',
    REFUND_NOT_ALLOWED = 'REFUND_NOT_ALLOWED',
    PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND',
    INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
}

// Transaction Types
export enum TransactionType {
    CHARGE = 'CHARGE',
    REFUND = 'REFUND',
    PARTIAL_REFUND = 'PARTIAL_REFUND',
    DECLINE = 'DECLINE',
    CHARGEBACK = 'CHARGEBACK',
}

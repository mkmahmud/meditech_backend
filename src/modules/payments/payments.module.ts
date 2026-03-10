import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentWebhooksController } from './payments-webhooks.controller';
import { PaymentWebhookService } from './payments-webhook.service';
import { StripePaymentProvider } from './providers/stripe.provider';
import { PayPalPaymentProvider } from './providers/paypal.provider';
import { CardPaymentProvider } from './providers/card.provider';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { EncryptionModule } from 'src/common/encryption/encryption.module';
import { RedisModule } from 'src/common/redis/redis.module';

/**
 * Payments Module
 * 
 * Provides comprehensive payment processing with:
 * - Multiple payment providers (Stripe, PayPal, Card)
 * - Multiple payment types (appointment, lab, medicine)
 * - Secure payment handling (PCI-DSS compliant)
 * - Refund management
 * - Webhook handling
 * - Audit logging
 * - Rate limiting
 * - Idempotency
 */
@Module({
    imports: [
        PrismaModule,
        EncryptionModule,
        RedisModule,
        ThrottlerModule.forRoot([
            {
                name: 'payments',
                ttl: 60000, // 1 minute
                limit: 10, // 10 requests per minute
            },
        ]),
    ],
    controllers: [PaymentsController, PaymentWebhooksController],
    providers: [
        PaymentsService,
        PaymentWebhookService,
        StripePaymentProvider,
        PayPalPaymentProvider,
        CardPaymentProvider,
    ],
    exports: [PaymentsService],
})
export class PaymentsModule { }

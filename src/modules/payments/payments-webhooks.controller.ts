import {
    Controller,
    Post,
    Body,
    Headers,
    Req,
    HttpCode,
    HttpStatus,
    Logger,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentWebhookService } from './payments-webhook.service';
import { Public } from 'src/common/decorators/auth.decorator';

/**
 * Payment Webhooks Controller
 * Handles incoming webhook events from payment providers
 */
@ApiTags('Payment Webhooks')
@Public()
@Controller('webhooks')
export class PaymentWebhooksController {
    private readonly logger = new Logger(PaymentWebhooksController.name);

    constructor(private webhookService: PaymentWebhookService) { }

    /**
     * Stripe webhook endpoint
     * Receives events like payment_intent.succeeded, charge.refunded, etc.
     */
    @Post('stripe')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Stripe Webhook',
        description: 'Webhook endpoint for Stripe payment events',
    })
    async handleStripeWebhook(
        @Req() req: Request,
        @Body() body: any,
        @Headers('stripe-signature') signature: string,
    ) {
        try {
            if (!signature) {
                this.logger.warn('Stripe webhook received without signature header');
                throw new BadRequestException('Missing stripe-signature header');
            }

            const rawBody = (req as any).rawBody as string | undefined;
            const parsedBody = body;

            this.logger.debug(`Received Stripe webhook: ${parsedBody?.type}`);

            const result = await this.webhookService.handleStripeWebhook(parsedBody, signature, rawBody);

            this.logger.debug(`Stripe webhook processed: ${result.received}`);
            return result;
        } catch (error) {
            this.logger.error(`Stripe webhook error: ${error.message}`);
            throw error;
        }
    }

    /**
     * PayPal webhook endpoint
     * Receives events like CHECKOUT.ORDER.COMPLETED, PAYMENT.CAPTURE.COMPLETED, etc.
     */
    @Post('paypal')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'PayPal Webhook',
        description: 'Webhook endpoint for PayPal payment events',
    })
    async handlePayPalWebhook(
        @Body() body: any,
        @Headers('paypal-transmission-id') transmissionId: string,
        @Headers('paypal-transmission-time') transmissionTime: string,
        @Headers('paypal-cert-url') certUrl: string,
        @Headers('paypal-transmission-sig') transmissionSig: string,
        @Headers('paypal-auth-algo') authAlgo: string,
    ) {
        try {
            // Validate required headers
            if (!transmissionId || !transmissionTime || !certUrl || !transmissionSig) {
                throw new BadRequestException('Missing PayPal webhook headers');
            }

            const webhookId = process.env.PAYPAL_WEBHOOK_ID;
            if (!webhookId) {
                throw new BadRequestException('PayPal webhook ID not configured');
            }

            this.logger.debug(
                `Received PayPal webhook: ${body?.event_type}`,
            );

            const result = await this.webhookService.handlePayPalWebhook(
                body,
                webhookId,
                transmissionId,
                transmissionTime,
                certUrl,
                transmissionSig,
            );

            return result;
        } catch (error) {
            this.logger.error(`PayPal webhook error: ${error.message}`);
            // Always return 200 to acknowledge receipt
            return { received: false, error: error.message };
        }
    }

    /**
     * Generic webhook test endpoint (for testing)
     */
    @Post('test')
    @HttpCode(HttpStatus.OK)
    testWebhook(@Body() body: any) {
        this.logger.log(`Received test webhook: ${JSON.stringify(body)}`);
        return {
            received: true,
            message: 'Test webhook received successfully',
            timestamp: new Date().toISOString(),
        };
    }
}

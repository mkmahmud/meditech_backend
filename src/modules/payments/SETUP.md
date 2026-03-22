# Payment Module Setup Guide

## Quick Start

### 1. Install Dependencies

The payment module requires the following npm packages. Check if they're already in your `package.json`:

```bash
npm install stripe
npm install @paypal/checkout-server-sdk
npm install zod
npm install uuid
npm install bcrypt
```

### 2. Configure Environment Variables

Create or update your `.env` file with:

```env
# ==========================================
# PAYMENT GATEWAY CONFIGURATION
# ==========================================

# Stripe Configuration
STRIPE_API_KEY=your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here

# PayPal Configuration
PAYPAL_CLIENT_ID=your_paypal_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_client_secret_here
PAYPAL_WEBHOOK_ID=your_paypal_webhook_id_here

# Application
NODE_ENV=development # 'development' for sandbox, 'production' for live
APP_URL=http://localhost:3000
API_PREFIX=api/v1

# ==========================================
# SECURITY & ENCRYPTION
# ==========================================

# Encryption Key (for sensitive payment data)
ENCRYPTION_KEY=your_32_character_encryption_key_here

# ==========================================
# DATABASE
# ==========================================

DATABASE_URL=postgresql://user:password@localhost:5432/meditech_db

# ==========================================
# CACHE/REDIS
# ==========================================

REDIS_URL=redis://localhost:6379/0

# ==========================================
# CORS
# ==========================================

CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

### 3. Database Migration

Run the Prisma migration to create payment tables:

```bash
npx prisma migrate deploy
# or for development:
npx prisma migrate dev --name "add payment tables"
```

### 4. Update App Module

Ensure `PaymentsModule` is imported in your `app.module.ts`:

```typescript
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    // ... other imports
    PaymentsModule,
  ],
})
export class AppModule {}
```

## Provider Setup

### Stripe Setup

1. **Create Stripe Account**
   - Go to https://stripe.com
   - Sign up and create account

2. **Get API Keys**
   - Navigate to Developers → API Keys
   - Copy "Publishable Key" and "Secret Key"
   - Add to `.env` file

3. **Configure Webhooks**
   - Go to Developers → Webhooks
   - Click "Add Endpoint"
   - URL must match your Nest global prefix + URI versioning setup
   - Common examples:
     - `http://localhost:5000/api/v1/webhooks/stripe`
     - `http://localhost:5000/api/v1/v1/webhooks/stripe`
   - Events to enable:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed` 
     - `charge.refunded`
   - Copy webhook signing secret to `.env`

### PayPal Setup

1. **Create PayPal Business Account**
   - Go to https://developer.paypal.com
   - Sign up and create account

2. **Create Application**
   - Go to Apps & Credentials
   - Create an app in Sandbox first
   - Copy Client ID and Secret
   - Add to `.env` file

3. **Configure Webhooks**
   - Go to Webhooks setup
   - Webhook URL: `https://your-domain/api/v1/webhooks/paypal`
   - Events to enable:
     - CHECKOUT.ORDER.COMPLETED
     - PAYMENT.CAPTURE.COMPLETED
     - PAYMENT.CAPTURE.REFUNDED
     - BILLING.SUBSCRIPTION.CANCELLED
   - Copy Webhook ID to `.env`

## Testing

### 1. Test Payment Creation (Stripe, Card, $100)

```bash
curl -X POST http://localhost:3000/api/v1/payments/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "currency": "USD",
    "paymentType": "APPOINTMENT_FEE",
    "provider": "STRIPE",
    "method": "CARD",
    "appointmentId": "appointment-uuid",
    "card": {
      "cardNumber": "4111111111111111",
      "cardholderName": "John Doe",
      "expiryMonth": 12,
      "expiryYear": 2026,
      "cvv": "123"
    },
    "idempotencyKey": "unique-request-id-uuid"
  }'
```

### 2. Test Card Numbers

**Stripe Sandbox:**
- Success: 4111 1111 1111 1111
- Decline: 4000 0000 0000 0002
- Visa: 4242 4242 4242 4242
- Mastercard: 5555 5555 5555 4444
- American Express: 3782 822463 10005

### 3. Local Testing with Webhooks

Use [Stripe CLI](https://stripe.com/docs/stripe-cli) for local webhook testing:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Trigger test event
stripe listen --forward-to localhost:5000/api/v1/v1/webhooks/stripe

# In another terminal, simulate payment
stripe trigger payment_intent.succeeded
```

## File Structure Created

```
src/modules/payments/
├── constants/
│   └── payment.constants.ts          # Enums, constants, configuration
├── providers/
│   ├── stripe.provider.ts            # Stripe payment provider
│   ├── paypal.provider.ts            # PayPal payment provider
│   └── card.provider.ts              # Direct card processing
├── schemas/
│   └── payment.schema.ts             # Zod validation schemas
├── payments.controller.ts            # REST API endpoints
├── payments.service.ts               # Business logic
├── payments-webhooks.controller.ts   # Webhook handlers
├── payments-webhook.service.ts       # Webhook processing
├── payments.module.ts                # Module configuration
├── PAYMENTS_MODULE.md                # Full documentation
└── SETUP.md                          # This file
```

## API Endpoints

### Create Payment
```
POST /api/v1/payments/create
Headers: Authorization: Bearer <JWT_TOKEN>
Request Body: CreatePaymentRequest
Response: { statusCode, message, data: Payment }
```

### Get Payment Details
```
GET /api/v1/payments/:paymentId
Headers: Authorization: Bearer <JWT_TOKEN>
Response: { statusCode, data: Payment }
```

### List Payments
```
GET /api/v1/payments?page=1&limit=20&status=COMPLETED&type=APPOINTMENT_FEE
Headers: Authorization: Bearer <JWT_TOKEN>
Response: { statusCode, data: { payments, total, page, limit } }
```

### Request Refund
```
POST /api/v1/payments/:paymentId/refund
Headers: Authorization: Bearer <JWT_TOKEN>
Request Body: { amount?, reason, idempotencyKey }
Response: { statusCode, message, data: Refund }
```

### Stripe Webhook
```
POST /api/v1/webhooks/stripe
Headers: stripe-signature: <signature>
```

### PayPal Webhook
```
POST /api/v1/webhooks/paypal
Headers: 
  - paypal-transmission-id
  - paypal-transmission-time
  - paypal-cert-url
  - paypal-transmission-sig
  - paypal-auth-algo
```

## Security Best Practices

1. **Never commit sensitive keys** - Use `.env.local` for local development
2. **Rotate API keys regularly** - Every 90 days in production
3. **Use HTTPS everywhere** - Required for production
4. **Validate all inputs** - Zod schemas are already in place
5. **Monitor webhook failures** - Set up alerts for webhook issues
6. **Enable 3D Secure on Stripe** - For enhanced security
7. **Log all transactions** - For audit trail
8. **Implement rate limiting** - Already configured
9. **Use idempotency keys** - Always send them
10. **Keep dependencies updated** - Regularly update npm packages

## Troubleshooting

### Payment Creation Fails

**Check:**
1. JWT token is valid and patient exists
2. Amount is within limits (0.01 - 999999.99)
3. Provider API keys are configured correctly
4. Network connection to provider
5. Card details are valid

### Webhook Not Received

**Check:**
1. Webhook URL is publicly accessible
2. Webhook secret is correctly configured
3. Provider webhook is enabled in dashboard
4. Firewall allows incoming connections
5. Check application logs for errors

### Card Declined

**Check:**
1. Card number is valid (Luhn algorithm)
2. Expiry date is not in the past
3. CVV is 3-4 digits
4. Card isn't test card in production
5. Check provider's decline reason

### Idempotency Key Error

**Check:**
1. Idempotency key is a valid UUID
2. Not reusing same key for different amounts
3. Previous request completed successfully

## Production Checklist

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] SSL certificate installed
- [ ] API keys rotated and secured
- [ ] Webhook endpoints tested
- [ ] Rate limiting working
- [ ] Encryption keys secured
- [ ] Audit logging enabled
- [ ] Error monitoring set up
- [ ] Payment processor sandbox tested
- [ ] Refund process tested
- [ ] Webhook retry logic tested
- [ ] Load testing completed
- [ ] Security audit done
- [ ] HIPAA compliance verified
- [ ] PCI-DSS compliance verified
- [ ] Backup strategy documented
- [ ] Disaster recovery tested
- [ ] Monitoring dashboards created
- [ ] On-call procedures documented

## Support & Resources

### Stripe
- Documentation: https://docs.stripe.com
- API Reference: https://stripe.com/docs/api
- Testing: https://stripe.com/docs/testing

### PayPal
- Documentation: https://developer.paypal.com
- Sandbox: https://sandbox.paypal.com
- Integration Guide: https://developer.paypal.com/docs

### Health Check

```bash
# Health endpoint
GET /api/v1/payments/health/check

# Expected response:
{
  "statusCode": 200,
  "message": "Payments service is healthy",
  "timestamp": "2026-03-10T10:30:00Z"
}
```

## Next Steps

1. Update app.module.ts to include PaymentsModule
2. Run database migrations
3. Configure environment variables
4. Set up Stripe and PayPal accounts
5. Configure webhooks
6. Test with test card numbers
7. Deploy to production
8. Monitor payment processing

---

**Last Updated:** March 10, 2026
**Module Version:** 1.0.0

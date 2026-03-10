# Payment Module Configuration Examples

## 1. Stripe Payment Example

### Create Stripe Payment

```typescript
// Controller receives request
POST /api/v1/payments/create

{
  "amount": 150.00,
  "currency": "USD",
  "paymentType": "APPOINTMENT_FEE",
  "provider": "STRIPE",
  "method": "CARD",
  "appointmentId": "550e8400-e29b-41d4-a716-446655440000",
  "card": {
    "cardNumber": "4111111111111111",
    "cardholderName": "John Doe",
    "expiryMonth": 12,
    "expiryYear": 2026,
    "cvv": "123"
  },
  "description": "Cardiology consultation with Dr. Smith",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440001"
}
```

### Service Processing Flow

```typescript
1. Check idempotency (already processed?)
   ↓
2. Validate patient exists
   ↓
3. Validate amount (0.01 - 999999.99)
   ↓
4. Validate appointment reference
   ↓
5. Generate invoice number (INV-1234567890-ABC)
   ↓
6. Create Payment record (status: PENDING)
   ↓
7. Call Stripe Provider
   - Create Payment Intent
   - Process card
   ↓
8. Update Payment (status: COMPLETED, transactionId, cardLastFour)
   ↓
9. Create PaymentTransaction record
   ↓
10. Log audit trail
    ↓
11. Return sanitized payment response
```

## 2. PayPal Payment Example

### Create PayPal Order

```typescript
POST /api/v1/payments/create

{
  "amount": 99.99,
  "currency": "USD",
  "paymentType": "LAB_TEST_FEE",
  "provider": "PAYPAL",
  "method": "ONLINE",
  "labTestId": "550e8400-e29b-41d4-a716-446655440002",
  "paypalEmail": "customer@example.com",
  "description": "COVID-19 Testing and Analysis",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440003"
}
```

### WebhookFlow

```
PayPal Creates Order
↓
Returns orderId + approvalUrl
↓
Customer approves payment
↓
Frontend redirects to callback URL
↓
Backend receives webhook
  - CHECKOUT.ORDER.COMPLETED → Order completed
  - PAYMENT.CAPTURE.COMPLETED → Payment captured
↓
Service updates Payment status to COMPLETED
↓
Create PaymentTransaction record
```

## 3. Direct Card Payment Example

### Process Card Payment

```typescript
POST /api/v1/payments/create

{
  "amount": 75.50,
  "currency": "USD",
  "paymentType": "MEDICINE_FEE",
  "provider": "CARD",
  "method": "CARD",
  "prescriptionId": "550e8400-e29b-41d4-a716-446655440004",
  "card": {
    "cardNumber": "5555555555554444",
    "cardholderName": "Jane Smith",
    "expiryMonth": 6,
    "expiryYear": 2025,
    "cvv": "456"
  },
  "description": "Prescription medications - Amoxicillin 500mg",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440005"
}
```

### Card Validation Process

```typescript
1. Validate card number with Luhn algorithm
   - 5555555555554444 → ✓ Valid 
   
2. Validate expiry
   - Current: March 2026
   - Card: June 2025 → ✗ Expired
   
3. Validate CVV
   - 456 → ✓ Valid (3-4 digits)
   
4. Validate cardholder name
   - Jane Smith → ✓ Valid (2+ characters)
   
5. Detect brand
   - Starts with 5 → Mastercard
```

## 4. Refund Example

### Request Refund

```typescript
POST /api/v1/payments/:paymentId/refund

{
  "amount": 75.50,  // Optional - full refund if omitted
  "reason": "Service cancelled due to doctor's emergency",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440006"
}
```

### Refund Processing

```typescript
1. Check idempotency (already refunded?)
2. Verify payment exists and belongs to patient
3. Verify payment status is COMPLETED
4. Validate refund amount
5. Create Refund record (status: PENDING)
6. Call provider refund
7. Update Refund status to COMPLETED
8. Update Payment totalRefunded
9. Update Payment status (FULLY_REFUNDED or PARTIALLY_PAID)
10. Log audit trail
```

### Webhook Response (Stripe Refund)

```
Stripe Processes Refund
↓
Returns refund status
↓
Sends webhook: charge.refunded
↓
Backend receives webhook
↓
Finds Payment by transactionId
↓
Updates Refund to COMPLETED
↓
Updates Payment totalRefunded + status
```

## 5. Multi-Provider Routing

### Provider Selection Strategy

```typescript
// User selects provider based on preference
const providerOptions = [
  {
    name: "STRIPE",
    label: "Credit/Debit Card",
    icon: "💳",
    fees: "2.9% + $0.30",
    processingTime: "Instant"
  },
  {
    name: "PAYPAL",
    label: "PayPal Account",
    icon: "🅿️",
    fees: "3.49%",
    processingTime: "1-2 hours"
  },
  {
    name: "CARD",
    label: "Direct Card Processing",
    icon: "🏧",
    fees: "2.5%",
    processingTime: "Instant"
  }
];
```

## 6. Payment Status Transitions

### Normal Flow (Successful)

```
PENDING
  ↓
COMPLETED (payment succeeded)
```

### Partial Refund Flow

```
PENDING
  ↓
COMPLETED (payment succeeded)
  ↓
PARTIALLY_PAID (after partial refund)
```

### Full Refund Flow

```
PENDING
  ↓
COMPLETED (payment succeeded)
  ↓
REFUNDED (after full refund)
```

### Failed Payment Flow

```
PENDING
  ↓
FAILED (payment declined)
```

### Cancelled Payment Flow

```
PENDING
  ↓
CANCELLED (user cancelled before payment)
```

## 7. Idempotency Key Usage

### Why Idempotency Matters

```typescript
// First request
POST /api/v1/payments/create
idempotencyKey: "abc-123-def"
amount: $100.00
→ Response: Payment created, transactionId: pi_123

// Connection fails, client retries with same key
POST /api/v1/payments/create
idempotencyKey: "abc-123-def"  // Same key
amount: $100.00
→ Response: Returns existing payment, transactionId: pi_123
   (Does NOT charge twice!)
```

### Generate Idempotency Key (Client Side)

```typescript
import { v4 as uuidv4 } from 'uuid';

const idempotencyKey = uuidv4();
// Use this key for the entire payment flow
// If payment fails, you can retry with same key
```

## 8. Database Structure After Payment

### Payment Record

```sql
SELECT * FROM payments WHERE id = '550e8400-e29b-41d4-a716-446655440000';

id                          | 550e8400-e29b-41d4-a716-446655440000
patientId                   | 550e8400-e29b-41d4-a716-446655440010
amount                      | 150.00
currency                    | USD
status                      | COMPLETED
method                      | CARD
provider                    | STRIPE
paymentType                 | APPOINTMENT_FEE
appointmentId               | 550e8400-e29b-41d4-a716-446655440100
transactionId               | pi_1234567890
cardLastFour                | ****1111
cardBrand                   | VISA
invoiceNumber               | INV-1234567890-ABC
invoiceUrl                  | s3://bucket/invoices/INV-1234567890-ABC.pdf
totalRefunded               | 0.00
idempotencyKey              | 550e8400-e29b-41d4-a716-446655440001
paidAt                      | 2026-03-10 10:30:00
createdAt                   | 2026-03-10 10:25:00
updatedAt                   | 2026-03-10 10:30:00
```

### PaymentTransaction Record

```sql
SELECT * FROM payment_transactions WHERE paymentId = '550e8400-e29b-41d4-a716-446655440000';

id        | type     | status  | amount | fee   | details (encrypted)
----------|----------|---------|--------|-------|-----------------------
tx_001    | CHARGE   | SUCCESS | 150.00 | 4.35  | {...encrypted data...}
```

### Refund Record

```sql
SELECT * FROM refunds WHERE paymentId = '550e8400-e29b-41d4-a716-446655440000';

id    | amount | reason                              | status      | processedAt
------|--------|-------------------------------------|-------------|-------------------
ref_1 | 75.50  | Service cancelled due to emergency  | COMPLETED   | 2026-03-10 11:30:00
```

## 9. Error Codes & Responses

### Invalid Amount

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": "Amount must be at least 0.01",
  "errorCode": "INVALID_AMOUNT"
}
```

### Duplicate Payment

```json
{
  "statusCode": 409,
  "message": "Conflict",
  "error": "Duplicate payment detected for this idempotency key",
  "errorCode": "DUPLICATE_REQUEST",
  "data": {
    "existingPaymentId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "COMPLETED",
    "transactionId": "pi_123"
  }
}
```

### Payment Provider Error

```json
{
  "statusCode": 402,
  "message": "Payment Required",
  "error": "Your card was declined",
  "errorCode": "PAYMENT_DECLINED"
}
```

### Unauthorized Access

```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": "You don't have access to this payment"
}
```

## 10. Security Audit Log Example

```sql
SELECT * FROM audit_logs WHERE resource = 'Payment' ORDER BY timestamp DESC LIMIT 5;

timestamp           | userId | action         | resourceId                          | phiAccessed | details
--------------------|--------|----------------|------------------------------------|-------------|----------------------------------
2026-03-10 10:30:00 | usr_1  | CREATE_PAYMENT | 550e8400-e29b-41d4-a716-446655440 | true        | amount:150.00, provider:STRIPE
2026-03-10 10:31:00 | usr_1  | GET_PAYMENT    | 550e8400-e29b-41d4-a716-446655440 | false       | Normal retrieval
2026-03-10 11:30:00 | usr_1  | REFUND_PAYMENT | 550e8400-e29b-41d4-a716-446655440 | true        | amount:75.50, reason:Cancelled
```

---

These examples demonstrate the complete payment flow for different providers and scenarios.

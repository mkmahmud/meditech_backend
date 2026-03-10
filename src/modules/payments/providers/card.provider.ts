import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_CONFIG } from '../constants/payment.constants';

interface CardPaymentResponse {
    transactionId: string;
    status: string;
    amount: number;
    currency: string;
    cardLastFour: string;
    cardBrand: string;
}

interface CardRefundResponse {
    refundId: string;
    status: string;
    amount: number;
}

/**
 * Card Payment Provider Service
 * Handles direct card processing through payment processors
 * Implements PCI-DSS compliance - never stores full card data
 */
@Injectable()
export class CardPaymentProvider {
    private readonly logger = new Logger(CardPaymentProvider.name);

    constructor(private configService: ConfigService) { }

    /**
     * Process a direct card payment
     * PCI-DSS: Card data should be tokenized by payment processor
     */
    async processCardPayment(
        amount: number,
        currency: string,
        cardData: any,
        idempotencyKey: string,
    ): Promise<CardPaymentResponse> {
        try {
            this.logger.debug(`Processing card payment: amount=${amount}, currency=${currency}`);

            // Validate amount
            if (amount < PAYMENT_CONFIG.MIN_PAYMENT_AMOUNT) {
                throw new Error(
                    `Amount must be at least ${PAYMENT_CONFIG.MIN_PAYMENT_AMOUNT}`,
                );
            }

            if (amount > PAYMENT_CONFIG.MAX_PAYMENT_AMOUNT) {
                throw new Error(
                    `Amount exceeds maximum limit of ${PAYMENT_CONFIG.MAX_PAYMENT_AMOUNT}`,
                );
            }

            // Validate card format
            this.validateCardData(cardData);

            // In production, tokenize the card through payment processor:
            // const token = await this.tokenizeCard(cardData);

            // Mock tokenization - in real scenario, this would come from processor
            const token = `tok_${this.generateRandomId()}`;

            // Mock charge response
            return {
                transactionId: `charge_${this.generateRandomId()}`,
                status: 'succeeded',
                amount: amount,
                currency: currency,
                cardLastFour: this.maskCardNumber(cardData.cardNumber),
                cardBrand: this.getCardBrand(cardData.cardNumber),
            };
        } catch (error) {
            this.logger.error(`Card payment processing failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Refund a card payment
     */
    async refundCardPayment(
        transactionId: string,
        amount: number,
        reason: string,
        idempotencyKey: string,
    ): Promise<CardRefundResponse> {
        try {
            this.logger.debug(
                `Refunding card payment: transactionId=${transactionId}, amount=${amount}`,
            );

            // Validate amount
            if (amount < PAYMENT_CONFIG.MIN_PAYMENT_AMOUNT) {
                throw new Error('Refund amount must be greater than 0');
            }

            // Mock refund response
            return {
                refundId: `refund_${this.generateRandomId()}`,
                status: 'succeeded',
                amount: amount,
            };
        } catch (error) {
            this.logger.error(`Card refund failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate card data format and integrity
     */
    private validateCardData(cardData: any): void {
        // Validate card number using Luhn algorithm
        if (!this.validateCardumber(cardData.cardNumber)) {
            throw new Error('Invalid card number');
        }

        // Validate expiry
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        if (
            cardData.expiryYear < currentYear ||
            (cardData.expiryYear === currentYear && cardData.expiryMonth < currentMonth)
        ) {
            throw new Error('Card has expired');
        }

        // Validate CVV
        if (!/^\d{3,4}$/.test(cardData.cvv)) {
            throw new Error('Invalid CVV');
        }

        // Validate cardholder name
        if (!cardData.cardholderName || cardData.cardholderName.length < 2) {
            throw new Error('Invalid cardholder name');
        }
    }

    /**
     * Luhn algorithm for card validation
     */
    private validateCardumber(cardNumber: string): boolean {
        const digits = cardNumber.replace(/\D/g, '');

        if (digits.length < 13 || digits.length > 19) {
            return false;
        }

        let sum = 0;
        let isEven = false;

        for (let i = digits.length - 1; i >= 0; i--) {
            let digit = parseInt(digits.charAt(i), 10);

            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    }

    /**
     * Mask card number for storage (PCI-DSS compliance)
     */
    private maskCardNumber(cardNumber: string): string {
        const digits = cardNumber.replace(/\D/g, '');
        const lastFour = digits.slice(-4);
        const masked = lastFour.padStart(Math.min(digits.length, 12), '*');
        return `****${masked}`;
    }

    /**
     * Extract card brand from card number
     */
    private getCardBrand(cardNumber: string): string {
        const patterns = {
            VISA: /^4[0-9]{12}(?:[0-9]{3})?$/,
            MASTERCARD: /^5[1-5][0-9]{14}$/,
            AMEX: /^3[47][0-9]{13}$/,
            DISCOVER: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
        };

        const digits = cardNumber.replace(/\D/g, '');

        for (const [brand, pattern] of Object.entries(patterns)) {
            if (pattern.test(digits)) {
                return brand;
            }
        }

        return 'UNKNOWN';
    }

    /**
     * Helper tokenize card (mock)
     * In production, this would use a secure payment processor
     */
    private async tokenizeCard(cardData: any): Promise<string> {
        try {
            // In production, call payment processor API:
            // const response = await fetch('https://api.paymentprocessor.com/tokenize', {
            //   method: 'POST',
            //   headers: {
            //     'Authorization': `Bearer ${this.configService.get('PAYMENT_PROCESSOR_API_KEY')}`,
            //     'Content-Type': 'application/json',
            //   },
            //   body: JSON.stringify({
            //     card_number: cardData.cardNumber,
            //     exp_month: cardData.expiryMonth,
            //     exp_year: cardData.expiryYear,
            //     cvc: cardData.cvv,
            //   }),
            // });
            // const result = await response.json();
            // return result.token;

            return `tok_${this.generateRandomId()}`;
        } catch (error) {
            this.logger.error(`Card tokenization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Helper to generate random ID
     */
    private generateRandomId(): string {
        return Math.random().toString(36).substring(2, 15);
    }
}

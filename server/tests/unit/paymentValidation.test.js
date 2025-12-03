/**
 * Tests for Payment Validation Service
 */

const {
    validatePaymentRequest,
    validateInvoicePayable,
    validateWebhookPayload,
    extractWebhookIds,
} = require('../../src/services/payment/validation/paymentValidation');

describe('Payment Validation Service', () => {
    describe('validatePaymentRequest', () => {
        it('should validate correct payment request', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
                name: 'John Doe',
                email: 'john@example.com',
                paymentMethod: 'card',
            };

            const method = validatePaymentRequest(request);

            expect(method).toBe('card');
        });

        it('should default to mpesa if paymentMethod not provided', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
                name: 'John Doe',
                email: 'john@example.com',
            };

            expect(() => validatePaymentRequest(request)).toThrow('Phone number is required for M-Pesa payment.');
        });

        it('should throw error if _id missing', () => {
            const request = {
                invoiceId: 'invoice_456',
                name: 'John Doe',
                email: 'john@example.com',
            };

            expect(() => validatePaymentRequest(request)).toThrow('Please provide _id and all required payment details.');
        });

        it('should throw error if invoiceId missing', () => {
            const request = {
                _id: 'user_123',
                name: 'John Doe',
                email: 'john@example.com',
            };

            expect(() => validatePaymentRequest(request)).toThrow('Please provide _id and all required payment details.');
        });

        it('should throw error if name missing', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
                email: 'john@example.com',
            };

            expect(() => validatePaymentRequest(request)).toThrow('Please provide _id and all required payment details.');
        });

        it('should throw error if email missing', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
                name: 'John Doe',
            };

            expect(() => validatePaymentRequest(request)).toThrow('Please provide _id and all required payment details.');
        });

        it('should throw error for invalid payment method', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
                name: 'John Doe',
                email: 'john@example.com',
                paymentMethod: 'paypal',
            };

            expect(() => validatePaymentRequest(request)).toThrow('Invalid payment method. Use "mpesa" or "card".');
        });

        it('should validate mpesa payment method', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
                name: 'John Doe',
                email: 'john@example.com',
                paymentMethod: 'mpesa',
                phone: '+254712345678',
            };

            const method = validatePaymentRequest(request);

            expect(method).toBe('mpesa');
        });

        it('should throw error if mpesa payment without phone', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
                name: 'John Doe',
                email: 'john@example.com',
                paymentMethod: 'mpesa',
            };

            expect(() => validatePaymentRequest(request)).toThrow('Phone number is required for M-Pesa payment.');
        });

        it('should set error status to 400', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
            };

            try {
                validatePaymentRequest(request);
                fail('Should have thrown error');
            } catch (error) {
                expect(error.status).toBe(400);
            }
        });

        it('should validate card payment method', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
                name: 'John Doe',
                email: 'john@example.com',
                paymentMethod: 'card',
            };

            const method = validatePaymentRequest(request);

            expect(method).toBe('card');
        });

        it('should not require phone for card payment', () => {
            const request = {
                _id: 'user_123',
                invoiceId: 'invoice_456',
                name: 'John Doe',
                email: 'john@example.com',
                paymentMethod: 'card',
                // No phone provided
            };

            const method = validatePaymentRequest(request);

            expect(method).toBe('card');
        });
    });

    describe('validateInvoicePayable', () => {
        it('should allow payment for unpaid invoice', () => {
            const invoice = { status: 'pending' };

            expect(() => validateInvoicePayable(invoice)).not.toThrow();
        });

        it('should allow payment for draft invoice', () => {
            const invoice = { status: 'draft' };

            expect(() => validateInvoicePayable(invoice)).not.toThrow();
        });

        it('should allow payment for overdue invoice', () => {
            const invoice = { status: 'overdue' };

            expect(() => validateInvoicePayable(invoice)).not.toThrow();
        });

        it('should throw error if invoice already paid', () => {
            const invoice = { status: 'paid' };

            expect(() => validateInvoicePayable(invoice)).toThrow('Invoice has already been paid.');
        });

        it('should set error status to 400', () => {
            const invoice = { status: 'paid' };

            try {
                validateInvoicePayable(invoice);
                fail('Should have thrown error');
            } catch (error) {
                expect(error.status).toBe(400);
            }
        });
    });

    describe('validateWebhookPayload', () => {
        const originalEnv = process.env.INTASEND_CHALLENGE_TOKEN;

        beforeAll(() => {
            process.env.INTASEND_CHALLENGE_TOKEN = 'test_challenge_token';
        });

        afterAll(() => {
            process.env.INTASEND_CHALLENGE_TOKEN = originalEnv;
        });

        it('should validate correct webhook payload', () => {
            const rawBody = JSON.stringify({
                challenge: 'test_challenge_token',
                invoice_id: 'inv_123',
                api_ref: 'ref_456',
            });

            const result = validateWebhookPayload({}, rawBody);

            expect(result).toBeDefined();
            expect(result.challenge).toBe('test_challenge_token');
            expect(result.invoice_id).toBe('inv_123');
        });

        it('should return null for invalid JSON', () => {
            const rawBody = 'not valid json {[}';

            const result = validateWebhookPayload({}, rawBody);

            expect(result).toBeNull();
        });

        it('should return null for wrong challenge token', () => {
            const rawBody = JSON.stringify({
                challenge: 'wrong_token',
                invoice_id: 'inv_123',
            });

            const result = validateWebhookPayload({}, rawBody);

            expect(result).toBeNull();
        });

        it('should return null for missing challenge token', () => {
            const rawBody = JSON.stringify({
                invoice_id: 'inv_123',
                api_ref: 'ref_456',
            });

            const result = validateWebhookPayload({}, rawBody);

            expect(result).toBeNull();
        });

        it('should parse complex webhook payload', () => {
            const rawBody = JSON.stringify({
                challenge: 'test_challenge_token',
                invoice_id: 'inv_123',
                api_ref: 'ref_456',
                transaction: {
                    amount: 1000,
                    currency: 'KES',
                },
            });

            const result = validateWebhookPayload({}, rawBody);

            expect(result).toBeDefined();
            expect(result.transaction.amount).toBe(1000);
        });
    });

    describe('extractWebhookIds', () => {
        it('should extract ids from top-level payload', () => {
            const payload = {
                invoice_id: 'inv_123',
                api_ref: 'ref_456',
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeDefined();
            expect(result.invoiceId).toBe('ref_456');
            expect(result.intasendInvoiceId).toBe('inv_123');
        });

        it('should extract ids from nested transaction object', () => {
            const payload = {
                transaction: {
                    invoice: {
                        invoice_id: 'inv_789',
                        api_ref: 'ref_012',
                    },
                },
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeDefined();
            expect(result.invoiceId).toBe('ref_012');
            expect(result.intasendInvoiceId).toBe('inv_789');
        });

        it('should prioritize top-level invoice_id', () => {
            const payload = {
                invoice_id: 'inv_top',
                api_ref: 'ref_123', // Need both IDs
                transaction: {
                    invoice: {
                        invoice_id: 'inv_nested',
                    },
                },
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeDefined();
            expect(result.intasendInvoiceId).toBe('inv_top');
        });

        it('should prioritize top-level api_ref', () => {
            const payload = {
                invoice_id: 'inv_123', // Need both IDs
                api_ref: 'ref_top',
                transaction: {
                    invoice: {
                        api_ref: 'ref_nested',
                    },
                },
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeDefined();
            expect(result.invoiceId).toBe('ref_top');
        });

        it('should return null if invoice_id missing', () => {
            const payload = {
                api_ref: 'ref_456',
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeNull();
        });

        it('should return null if api_ref missing', () => {
            const payload = {
                invoice_id: 'inv_123',
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeNull();
        });

        it('should return null if both ids missing', () => {
            const payload = {
                transaction: {
                    amount: 1000,
                },
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeNull();
        });

        it('should extract from mixed structure (top + nested)', () => {
            const payload = {
                invoice_id: 'inv_top',
                transaction: {
                    invoice: {
                        api_ref: 'ref_nested',
                    },
                },
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeDefined();
            expect(result.invoiceId).toBe('ref_nested');
            expect(result.intasendInvoiceId).toBe('inv_top');
        });

        it('should handle empty transaction object', () => {
            const payload = {
                transaction: {},
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeNull();
        });

        it('should handle null transaction', () => {
            const payload = {
                transaction: null,
            };

            const result = extractWebhookIds(payload);

            expect(result).toBeNull();
        });
    });
});

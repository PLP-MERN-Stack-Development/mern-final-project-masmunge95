/**
 * Tests for Payment Provider Service
 */

// Create mock instances that will be reused
const mockCheckout = { create: jest.fn() };
const mockCollection = {
    status: jest.fn(),
    mpesaStkPush: jest.fn(),
    charge: jest.fn(),
};
const mockPayouts = {
    mpesa: jest.fn(),
    bank: jest.fn(),
    intasendTransfer: jest.fn(),
};

// Mock IntaSend before requiring the module
jest.mock('intasend-node', () => {
    return jest.fn().mockImplementation(() => ({
        checkout: mockCheckout,
        collection: () => mockCollection,
        payouts: () => mockPayouts,
    }));
});

const {
    convertUsdToKsh,
    createIntasendCheckout,
    verifyTransaction,
    collectMpesaPayment,
    collectCardPayment,
    processPayment,
    processWithdrawalPayout,
} = require('../../src/utils/paymentProvider');

describe('Payment Provider Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('convertUsdToKsh', () => {
        it('should convert USD to KES at 130 rate', () => {
            expect(convertUsdToKsh(100)).toBe(13000);
        });

        it('should round to nearest integer', () => {
            expect(convertUsdToKsh(10.5)).toBe(1365);
        });

        it('should handle zero amount', () => {
            expect(convertUsdToKsh(0)).toBe(0);
        });

        it('should handle decimal amounts correctly', () => {
            expect(convertUsdToKsh(0.5)).toBe(65);
        });

        it('should handle large amounts', () => {
            expect(convertUsdToKsh(10000)).toBe(1300000);
        });
    });

    describe('createIntasendCheckout', () => {
        it('should create checkout successfully', async () => {
            mockCheckout.create.mockResolvedValue({
                data: { payment_link: 'https://payment.link/test' },
            });

            const result = await createIntasendCheckout({
                amount: 1000,
                currency: 'KES',
                api_ref: 'invoice_123',
            });

            expect(result).toBe('https://payment.link/test');
        });

        it('should throw error if checkout creation fails', async () => {
            mockCheckout.create.mockRejectedValue(new Error('API Error'));

            await expect(
                createIntasendCheckout({
                    amount: 1000,
                    currency: 'KES',
                    api_ref: 'invoice_123',
                })
            ).rejects.toThrow('Failed to create payment checkout.');
        });

        it('should use environment FRONTEND_URL', async () => {
            process.env.FRONTEND_URL = 'https://myapp.com';
            mockCheckout.create.mockResolvedValue({
                data: { payment_link: 'https://payment.link/test' },
            });

            await createIntasendCheckout({
                amount: 500,
                currency: 'USD',
                api_ref: 'ref_456',
            });

            expect(mockCheckout.create).toHaveBeenCalledWith({
                amount: 500,
                currency: 'USD',
                api_ref: 'ref_456',
                host: 'https://myapp.com',
            });
        });
    });

    describe('verifyTransaction', () => {
        it('should verify transaction successfully', async () => {
            const mockResponse = {
                invoice_id: 'inv_123',
                status: 'COMPLETE',
                amount: 1000,
            };
            mockCollection.status.mockResolvedValue(mockResponse);

            const result = await verifyTransaction('invoice_123');

            expect(result).toEqual(mockResponse);
        });

        it('should throw error if verification fails', async () => {
            mockCollection.status.mockRejectedValue(new Error('Not found'));

            await expect(verifyTransaction('invalid_id')).rejects.toThrow(
                'Failed to verify transaction'
            );
        });
    });

    describe('collectMpesaPayment', () => {
        it('should initiate M-Pesa payment successfully', async () => {
            const mockResponse = {
                invoice: {
                    invoice_id: 'mpesa_inv_123',
                    state: 'PENDING',
                },
            };
            mockCollection.mpesaStkPush.mockResolvedValue(mockResponse);

            const result = await collectMpesaPayment({
                amount: 1000,
                currency: 'KES',
                email: 'test@example.com',
                phone_number: '+254712345678',
                api_ref: 'invoice_123',
                first_name: 'John',
                last_name: 'Doe',
            });

            expect(result).toEqual(mockResponse);
        });

        it('should throw error if STK push fails', async () => {
            mockCollection.mpesaStkPush.mockRejectedValue(new Error('API Error'));

            await expect(
                collectMpesaPayment({
                    amount: 1000,
                    currency: 'KES',
                    email: 'test@example.com',
                    phone_number: '+254712345678',
                    api_ref: 'invoice_123',
                    first_name: 'John',
                    last_name: 'Doe',
                })
            ).rejects.toThrow('Failed to initiate M-Pesa payment.');
        });
    });

    describe('collectCardPayment', () => {
        it('should initiate card payment successfully', async () => {
            const mockResponse = {
                id: 'card_123',
                state: 'PENDING',
            };
            mockCollection.charge.mockResolvedValue(mockResponse);

            const result = await collectCardPayment({
                amount: 5000,
                currency: 'KES',
                email: 'test@example.com',
                api_ref: 'invoice_456',
                first_name: 'Jane',
                last_name: 'Doe',
            });

            expect(result).toEqual(mockResponse);
        });

        it('should throw error if card payment fails', async () => {
            mockCollection.charge.mockRejectedValue(new Error('API Error'));

            await expect(
                collectCardPayment({
                    amount: 5000,
                    currency: 'KES',
                    email: 'test@example.com',
                    api_ref: 'invoice_456',
                    first_name: 'Jane',
                    last_name: 'Doe',
                })
            ).rejects.toThrow('Failed to initiate card payment.');
        });
    });

    describe('processPayment', () => {
        it('should process M-Pesa payment with USD conversion', async () => {
            const mockResponse = {
                invoice: { invoice_id: 'mpesa_123', state: 'PENDING' },
            };
            mockCollection.mpesaStkPush.mockResolvedValue(mockResponse);

            const result = await processPayment({
                amount: 10,
                currency: 'USD',
                email: 'test@example.com',
                phoneNumber: '+254712345678',
                method: 'MPESA',
                metadata: { userId: 'user_123', firstName: 'John', lastName: 'Doe' },
            });

            expect(result.success).toBe(true);
            expect(result.transactionId).toBe('mpesa_123');
            expect(result.amountKsh).toBe(1300);
        });

        it('should process card payment with USD conversion', async () => {
            const mockResponse = { 
                invoice: { invoice_id: 'card_123' },
                checkout: { url: 'https://checkout.link' }
            };
            mockCollection.charge.mockResolvedValue(mockResponse);

            const result = await processPayment({
                amount: 20,
                currency: 'USD',
                email: 'test@example.com',
                method: 'CARD',
                metadata: { userId: 'user_456', firstName: 'Jane', lastName: 'Doe' },
            });

            expect(result.success).toBe(true);
            expect(result.transactionId).toBe('card_123');
            expect(result.amountKsh).toBe(2600);
        });

        it('should process payment in KES without conversion', async () => {
            const mockResponse = {
                invoice: { invoice_id: 'mpesa_kes_123' },
            };
            mockCollection.mpesaStkPush.mockResolvedValue(mockResponse);

            const result = await processPayment({
                amount: 5000,
                currency: 'KES',
                email: 'test@example.com',
                phoneNumber: '+254700000000',
                method: 'MPESA',
                metadata: { userId: 'user_789' },
            });

            expect(result.success).toBe(true);
            expect(result.amountKsh).toBe(5000);
        });

        it('should return error for unsupported payment method', async () => {
            const result = await processPayment({
                amount: 100,
                currency: 'KES',
                email: 'test@example.com',
                method: 'BITCOIN',
                metadata: { userId: 'user_999' },
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported payment method');
        });

        it('should handle payment processing errors', async () => {
            mockCollection.mpesaStkPush.mockRejectedValue(
                new Error('Payment failed')
            );

            const result = await processPayment({
                amount: 1000,
                currency: 'KES',
                email: 'test@example.com',
                phoneNumber: '+254712345678',
                method: 'MPESA',
                metadata: { userId: 'user_error' },
            });

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to initiate M-Pesa payment');
        });

        it('should use default names if not provided in metadata', async () => {
            const mockResponse = { 
                invoice: { invoice_id: 'card_default' }
            };
            mockCollection.charge.mockResolvedValue(mockResponse);

            const result = await processPayment({
                amount: 1000,
                currency: 'KES',
                email: 'test@example.com',
                method: 'CARD',
                metadata: { userId: 'user_default' },
            });

            expect(result.success).toBe(true);
            expect(mockCollection.charge).toHaveBeenCalledWith(
                expect.objectContaining({
                    first_name: 'Subscriber',
                    last_name: 'User',
                })
            );
        });

        it('should extract invoice_id from nested response', async () => {
            const mockResponse = {
                invoice: { invoice_id: 'nested_123', state: 'COMPLETE' },
            };
            mockCollection.mpesaStkPush.mockResolvedValue(mockResponse);

            const result = await processPayment({
                amount: 500,
                currency: 'KES',
                email: 'test@example.com',
                phoneNumber: '+254700000000',
                method: 'MPESA',
                metadata: { userId: 'user_nested' },
            });

            expect(result.transactionId).toBe('nested_123');
        });
    });

    describe('processWithdrawalPayout', () => {
        it('should process M-Pesa payout successfully', async () => {
            const mockResponse = {
                tracking_id: 'payout_mpesa_123',
                status: 'processing',
            };
            mockPayouts.mpesa.mockResolvedValue(mockResponse);

            const result = await processWithdrawalPayout({
                requestId: 'withdrawal_123',
                amount: 5000,
                currency: 'KES',
                method: 'mpesa',
                details: { mpesaNumber: '+254712345678' },
            });

            expect(result.success).toBe(true);
            expect(result.transactionId).toBe('payout_mpesa_123');
        });

        it('should process bank payout successfully', async () => {
            const mockResponse = {
                tracking_id: 'payout_bank_456',
                status: 'processing',
            };
            mockPayouts.bank.mockResolvedValue(mockResponse);

            const result = await processWithdrawalPayout({
                requestId: 'withdrawal_456',
                amount: 10000,
                currency: 'KES',
                method: 'bank',
                details: {
                    accountNumber: '1234567890',
                    accountName: 'John Doe',
                    branchCode: '01',
                },
            });

            expect(result.success).toBe(true);
            expect(result.transactionId).toBe('payout_bank_456');
        });

        it('should process IntaSend wallet payout successfully', async () => {
            const mockResponse = {
                tracking_id: 'payout_wallet_789',
                status: 'processing',
            };
            mockPayouts.intasendTransfer.mockResolvedValue(mockResponse);

            const result = await processWithdrawalPayout({
                requestId: 'withdrawal_789',
                amount: 3000,
                currency: 'KES',
                method: 'intasend_wallet',
                details: { walletEmail: 'seller@example.com' },
            });

            expect(result.success).toBe(true);
            expect(result.transactionId).toBe('payout_wallet_789');
        });

        it('should convert USD to KES for payouts', async () => {
            const mockResponse = { tracking_id: 'payout_usd_123' };
            mockPayouts.mpesa.mockResolvedValue(mockResponse);

            const result = await processWithdrawalPayout({
                requestId: 'withdrawal_usd',
                amount: 10,
                currency: 'USD',
                method: 'mpesa',
                details: { mpesaNumber: '+254712345678' },
            });

            expect(result.success).toBe(true);
        });

        it('should throw error for unsupported payout method', async () => {
            await expect(
                processWithdrawalPayout({
                    requestId: 'withdrawal_error',
                    amount: 1000,
                    currency: 'KES',
                    method: 'paypal',
                })
            ).rejects.toThrow('Payout failed');
        });

        it('should throw error on payout failure', async () => {
            mockPayouts.mpesa.mockRejectedValue(new Error('Network error'));

            await expect(
                processWithdrawalPayout({
                    requestId: 'withdrawal_fail',
                    amount: 1000,
                    currency: 'KES',
                    method: 'mpesa',
                    details: { mpesaNumber: '+254712345678' },
                })
            ).rejects.toThrow('Payout failed');
        });

        it('should use fallback transaction ID if tracking_id missing', async () => {
            const mockResponse = { id: 'fallback_id_123', status: 'processing' };
            mockPayouts.mpesa.mockResolvedValue(mockResponse);

            const result = await processWithdrawalPayout({
                requestId: 'withdrawal_fallback',
                amount: 2000,
                currency: 'KES',
                method: 'mpesa',
                details: { mpesaNumber: '+254700000000' },
            });

            expect(result.success).toBe(true);
            expect(result.transactionId).toBe('fallback_id_123');
        });
    });
});

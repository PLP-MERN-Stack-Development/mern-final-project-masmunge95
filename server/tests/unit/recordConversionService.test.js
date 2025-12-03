const mongoose = require('mongoose');
const {
    validateConversionRequirements,
    buildInvoiceItems,
    calculateInvoiceTotals,
    buildInvoiceDates,
    getSellerMetadata,
    buildInvoicePayload,
} = require('../../src/services/record/conversion/recordConversionService');
const Customer = require('../../src/models/Customer');

describe('Record Conversion Service', () => {
    describe('validateConversionRequirements', () => {
        it('should throw error if record already linked to invoice', () => {
            const record = { linkedInvoiceId: 'invoice_123' };
            
            expect(() => validateConversionRequirements(record, null, 'user_123'))
                .toThrow('Record has already been converted to an invoice.');
        });

        it('should throw error if no customerId provided', () => {
            const record = { customer: null };
            
            expect(() => validateConversionRequirements(record, null, 'user_123'))
                .toThrow('Cannot convert record: no customer specified');
        });

        it('should use customerId from parameters if provided', () => {
            const record = { customer: 'old_customer' };
            const customerId = 'new_customer';
            
            expect(() => validateConversionRequirements(record, customerId, 'user_123'))
                .not.toThrow();
        });

        it('should use record.customer if no customerId parameter', () => {
            const record = { customer: 'customer_123' };
            
            expect(() => validateConversionRequirements(record, null, 'user_123'))
                .not.toThrow();
        });
    });

    describe('buildInvoiceItems', () => {
        it('should build items from record.extracted.lineItems', () => {
            const extracted = {
                lineItems: [
                    { description: 'Item 1', quantity: 2, unitPrice: 100 },
                    { description: 'Item 2', quantity: 1, price: 50 },
                ]
            };

            const items = buildInvoiceItems(extracted, 500);

            expect(items).toHaveLength(2);
            expect(items[0]).toEqual({
                description: 'Item 1',
                quantity: 2,
                unitPrice: 100,
            });
            expect(items[1]).toEqual({
                description: 'Item 2',
                quantity: 1,
                unitPrice: 50,
            });
        });

        it('should build items from record.extracted.items if no lineItems', () => {
            const extracted = {
                items: [
                    { name: 'Service A', quantity: 1, rate: 200 },
                    { description: 'Service B', unit_amount: 150 },
                ]
            };

            const items = buildInvoiceItems(extracted, 350);

            expect(items).toHaveLength(2);
            expect(items[0].description).toBe('Service A');
            expect(items[0].unitPrice).toBe(200);
            expect(items[1].description).toBe('Service B');
            expect(items[1].unitPrice).toBe(150);
        });

        it('should handle item with total field', () => {
            const extracted = {
                lineItems: [
                    { description: 'Bulk Item', total: 300 }
                ]
            };

            const items = buildInvoiceItems(extracted, 300);

            expect(items[0].unitPrice).toBe(300);
            expect(items[0].quantity).toBe(1);
        });

        it('should create single line item from total if no lineItems/items', () => {
            const extracted = { totalAmount: 1000 };

            const items = buildInvoiceItems(extracted, 1000);

            expect(items).toHaveLength(1);
            expect(items[0]).toEqual({
                description: 'Record Total',
                quantity: 1,
                unitPrice: 1000,
            });
        });

        it('should default missing values', () => {
            const extracted = {
                lineItems: [
                    { description: 'Incomplete Item' }
                ]
            };

            const items = buildInvoiceItems(extracted, 100);

            expect(items[0].quantity).toBe(1);
            expect(items[0].unitPrice).toBe(0);
        });
    });

    describe('calculateInvoiceTotals', () => {
        it('should calculate subtotal and total from items', () => {
            const items = [
                { quantity: 2, unitPrice: 100 },
                { quantity: 1, unitPrice: 50 },
            ];
            const extracted = {};

            const result = calculateInvoiceTotals(items, extracted);

            expect(result.subtotal).toBe(250);
            expect(result.total).toBe(250);
            expect(result.tax).toBe(0);
        });

        it('should include tax if provided in extracted', () => {
            const items = [
                { quantity: 2, unitPrice: 100 },
            ];
            const extracted = { tax: 20 };

            const result = calculateInvoiceTotals(items, extracted);

            expect(result.subtotal).toBe(200);
            expect(result.tax).toBe(20);
            expect(result.total).toBe(220);
        });

        it('should handle taxAmount field', () => {
            const items = [
                { quantity: 1, unitPrice: 100 },
            ];
            const extracted = { taxAmount: 15 };

            const result = calculateInvoiceTotals(items, extracted);

            expect(result.tax).toBe(15);
            expect(result.total).toBe(115);
        });

        it('should default tax to 0 if not provided', () => {
            const items = [
                { quantity: 3, unitPrice: 50 },
            ];
            const extracted = {};

            const result = calculateInvoiceTotals(items, extracted);

            expect(result.tax).toBe(0);
            expect(result.total).toBe(150);
        });
    });

    describe('buildInvoiceDates', () => {
        it('should use issueDate and dueDate from extracted', () => {
            const extracted = {
                issueDate: '2025-01-15',
                dueDate: '2025-02-15',
            };

            const result = buildInvoiceDates(extracted);

            expect(result.issueDate).toEqual(new Date('2025-01-15'));
            expect(result.dueDate).toEqual(new Date('2025-02-15'));
        });

        it('should use date field as issueDate if issueDate not provided', () => {
            const extracted = {
                date: '2025-01-10',
                dueDate: '2025-02-10',
            };

            const result = buildInvoiceDates(extracted);

            expect(result.issueDate).toEqual(new Date('2025-01-10'));
        });

        it('should default to current date if no issueDate/date', () => {
            const extracted = {};
            const before = new Date();

            const result = buildInvoiceDates(extracted);

            const after = new Date();
            expect(result.issueDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(result.issueDate.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it('should set dueDate to 30 days after issueDate if not provided', () => {
            const extracted = {
                issueDate: '2025-01-01',
            };

            const result = buildInvoiceDates(extracted);

            const expectedDueDate = new Date('2025-01-01');
            expectedDueDate.setDate(expectedDueDate.getDate() + 30);
            
            expect(result.dueDate).toEqual(expectedDueDate);
        });
    });

    describe('getSellerMetadata', () => {
        it('should return seller metadata from Clerk', async () => {
            const userId = 'user_seller123';

            const result = await getSellerMetadata(userId);

            expect(result).toHaveProperty('sellerName');
            expect(result).toHaveProperty('sellerPrefix');
        });

        it('should handle errors gracefully', async () => {
            const userId = null;

            const result = await getSellerMetadata(userId);

            expect(result.sellerName).toBe('Unknown Seller');
            expect(result.sellerPrefix).toBe('INV');
        });
    });

    describe('buildInvoicePayload', () => {
        let customer;

        beforeEach(async () => {
            customer = await Customer.create({
                _id: new mongoose.Types.ObjectId(),
                name: 'Test Customer',
                email: 'customer@test.com',
                phone: '+254712345678',
                users: ['user_123'],
            });
        });

        it('should build complete invoice payload', async () => {
            const record = {
                _id: 'record_123',
                user: 'user_seller123',
                customer: customer._id,
                extracted: {
                    lineItems: [
                        { description: 'Service', quantity: 1, unitPrice: 1000 }
                    ],
                    tax: 100,
                    issueDate: '2025-01-01',
                    dueDate: '2025-01-31',
                },
            };

            const payload = await buildInvoicePayload(record, customer._id.toString(), 'user_seller123');

            expect(payload.user).toBe('user_seller123');
            expect(payload.customer).toBe(customer._id.toString());
            expect(payload.items).toHaveLength(1);
            expect(payload.items[0].description).toBe('Service');
            expect(payload.subtotal).toBe(1000);
            expect(payload.tax).toBe(100);
            expect(payload.total).toBe(1100);
            expect(payload.issueDate).toEqual(new Date('2025-01-01'));
            expect(payload.dueDate).toEqual(new Date('2025-01-31'));
            expect(payload.status).toBe('pending');
            expect(payload.convertedFromRecord).toBe('record_123');
        });

        it('should include seller metadata in payload', async () => {
            const record = {
                _id: 'record_456',
                user: 'user_seller456',
                customer: customer._id,
                extracted: {
                    totalAmount: 500,
                },
            };

            const payload = await buildInvoicePayload(record, customer._id.toString(), 'user_seller456');

            expect(payload).toHaveProperty('sellerName');
            expect(payload).toHaveProperty('sellerPrefix');
        });

        it('should handle minimal extracted data', async () => {
            const record = {
                _id: 'record_789',
                user: 'user_seller789',
                customer: customer._id,
                extracted: {},
            };

            const payload = await buildInvoicePayload(record, customer._id.toString(), 'user_seller789');

            expect(payload.items).toHaveLength(1);
            expect(payload.items[0].description).toBe('Record Total');
            expect(payload.subtotal).toBe(0);
            expect(payload.total).toBe(0);
            expect(payload.status).toBe('pending');
        });
    });
});

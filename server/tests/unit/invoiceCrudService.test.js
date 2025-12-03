const mongoose = require('mongoose');
const {
    findInvoiceById,
    findInvoices,
    createInvoice,
    updateInvoiceById,
    deleteInvoiceById,
    countInvoices,
    findCustomerByIdAndUser,
    findCustomerByContact,
    findCustomerByContactAndUser,
    createCustomer,
    linkUserToCustomer,
    findInvoiceByTempId,
    recalculateInvoiceTotals,
} = require('../../src/services/invoice/crud/invoiceCrudService');
const Invoice = require('../../src/models/Invoice');
const Customer = require('../../src/models/Customer');

describe('Invoice CRUD Service', () => {
    describe('findInvoiceById', () => {
        it('should find invoice by id', async () => {
            const invoice = await Invoice.create({
                user: 'user_123',
                customer: new mongoose.Types.ObjectId(),
                customerName: 'Test Customer',
                invoiceNumber: 'INV-001',
                items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
                subTotal: 100,
                total: 100,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
            });

            const found = await findInvoiceById(invoice._id);

            expect(found).toBeDefined();
            expect(found._id.toString()).toBe(invoice._id.toString());
            expect(found.status).toBe('draft');
        });

        it('should return null if invoice not found', async () => {
            const found = await findInvoiceById('non-existent-id');

            expect(found).toBeNull();
        });

        it('should populate customer when requested', async () => {
            const customerId = new mongoose.Types.ObjectId();
            const invoice = await Invoice.create({
                user: 'user_123',
                customer: customerId,
                customerName: 'Test Customer',
                invoiceNumber: 'INV-002',
                items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
                subTotal: 100,
                total: 100,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
            });

            const found = await findInvoiceById(invoice._id, { populate: 'customer' });

            expect(found).toBeDefined();
            expect(found.customer).toBeDefined();
        });
    });

    describe('findInvoices', () => {
        beforeEach(async () => {
            await Invoice.create([
                {
                    user: 'user_123',
                    customer: new mongoose.Types.ObjectId(),
                    customerName: 'Customer A',
                    invoiceNumber: 'INV-101',
                    items: [{ description: 'Invoice 1', quantity: 1, unitPrice: 100, total: 100 }],
                    subTotal: 100,
                    total: 100,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'draft',
                },
                {
                    user: 'user_123',
                    customer: new mongoose.Types.ObjectId(),
                    customerName: 'Customer B',
                    invoiceNumber: 'INV-102',
                    items: [{ description: 'Invoice 2', quantity: 1, unitPrice: 200, total: 200 }],
                    subTotal: 200,
                    total: 200,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'paid',
                },
                {
                    user: 'user_456',
                    customer: new mongoose.Types.ObjectId(),
                    customerName: 'Customer C',
                    invoiceNumber: 'INV-103',
                    items: [{ description: 'Invoice 3', quantity: 1, unitPrice: 150, total: 150 }],
                    subTotal: 150,
                    total: 150,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'draft',
                },
            ]);
        });

        it('should find invoices with filter', async () => {
            const invoices = await findInvoices({ user: 'user_123' });

            expect(invoices).toHaveLength(2);
            expect(invoices[0].user).toBe('user_123');
            expect(invoices[1].user).toBe('user_123');
        });

        it('should find invoices by status', async () => {
            const invoices = await findInvoices({ status: 'draft' });

            expect(invoices).toHaveLength(2);
            expect(invoices[0].status).toBe('draft');
            expect(invoices[1].status).toBe('draft');
        });

        it('should sort invoices', async () => {
            const invoices = await findInvoices({}, { sort: { total: -1 } });

            expect(invoices).toHaveLength(3);
            expect(invoices[0].total).toBe(200);
            expect(invoices[1].total).toBe(150);
            expect(invoices[2].total).toBe(100);
        });

        it('should limit results', async () => {
            const invoices = await findInvoices({}, { limit: 2 });

            expect(invoices).toHaveLength(2);
        });

        it('should skip results for pagination', async () => {
            const invoices = await findInvoices({}, { skip: 1, limit: 2 });

            expect(invoices).toHaveLength(2);
        });

        it('should return empty array if no matches', async () => {
            const invoices = await findInvoices({ user: 'user_nonexistent' });

            expect(invoices).toHaveLength(0);
        });
    });

    describe('createInvoice', () => {
        it('should create new invoice', async () => {
            const invoiceData = {
                user: 'user_123',
                customer: new mongoose.Types.ObjectId(),
                customerName: 'New Customer',
                invoiceNumber: 'INV-201',
                items: [{ description: 'New Invoice', quantity: 1, unitPrice: 500, total: 500 }],
                subTotal: 500,
                total: 500,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
            };

            const invoice = await createInvoice(invoiceData);

            expect(invoice).toBeDefined();
            expect(invoice._id).toBeDefined();
            expect(invoice.user).toBe('user_123');
            expect(invoice.total).toBe(500);
        });

        it('should save invoice to database', async () => {
            const invoiceData = {
                user: 'user_456',
                customer: new mongoose.Types.ObjectId(),
                customerName: 'Test Customer',
                invoiceNumber: 'INV-202',
                items: [{ description: 'Test', quantity: 2, unitPrice: 250, total: 500 }],
                subTotal: 500,
                total: 500,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
            };

            const created = await createInvoice(invoiceData);
            const found = await Invoice.findById(created._id);

            expect(found).toBeDefined();
            expect(found.user).toBe('user_456');
        });
    });

    describe('updateInvoiceById', () => {
        it('should update invoice', async () => {
            const invoice = await Invoice.create({
                user: 'user_123',
                customer: new mongoose.Types.ObjectId(),
                customerName: 'Test Customer',
                invoiceNumber: 'INV-301',
                items: [{ description: 'Original', quantity: 1, unitPrice: 100, total: 100 }],
                subTotal: 100,
                total: 100,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
            });

            const updated = await updateInvoiceById(invoice._id, { status: 'paid' });

            expect(updated).toBeDefined();
            expect(updated.status).toBe('paid');
        });

        it('should return null if invoice not found', async () => {
            const updated = await updateInvoiceById('non-existent-id', { status: 'paid' });

            expect(updated).toBeNull();
        });

        it('should update multiple fields', async () => {
            const invoice = await Invoice.create({
                user: 'user_123',
                customer: new mongoose.Types.ObjectId(),
                customerName: 'Test Customer',
                invoiceNumber: 'INV-302',
                items: [{ description: 'Original', quantity: 1, unitPrice: 100, total: 100 }],
                subTotal: 100,
                total: 100,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
            });

            const updated = await updateInvoiceById(invoice._id, {
                status: 'void',
                notes: 'Customer requested cancellation',
            });

            expect(updated.status).toBe('void');
            expect(updated.notes).toBe('Customer requested cancellation');
        });
    });

    describe('deleteInvoiceById', () => {
        it('should delete invoice', async () => {
            const invoice = await Invoice.create({
                user: 'user_123',
                customer: new mongoose.Types.ObjectId(),
                customerName: 'Test Customer',
                invoiceNumber: 'INV-401',
                items: [{ description: 'To Delete', quantity: 1, unitPrice: 100, total: 100 }],
                subTotal: 100,
                total: 100,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
            });

            const deleted = await deleteInvoiceById(invoice._id);

            expect(deleted).toBeDefined();
            expect(deleted._id.toString()).toBe(invoice._id.toString());

            const found = await Invoice.findById(invoice._id);
            expect(found).toBeNull();
        });

        it('should return null if invoice not found', async () => {
            const deleted = await deleteInvoiceById('non-existent-id');

            expect(deleted).toBeNull();
        });
    });

    describe('countInvoices', () => {
        beforeEach(async () => {
            await Invoice.create([
                {
                    user: 'user_123',
                    customer: new mongoose.Types.ObjectId(),
                    customerName: 'Customer A',
                    invoiceNumber: 'INV-501',
                    items: [{ description: 'Invoice 1', quantity: 1, unitPrice: 100, total: 100 }],
                    subTotal: 100,
                    total: 100,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'draft',
                },
                {
                    user: 'user_123',
                    customer: new mongoose.Types.ObjectId(),
                    customerName: 'Customer B',
                    invoiceNumber: 'INV-502',
                    items: [{ description: 'Invoice 2', quantity: 1, unitPrice: 200, total: 200 }],
                    subTotal: 200,
                    total: 200,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'paid',
                },
                {
                    user: 'user_456',
                    customer: new mongoose.Types.ObjectId(),
                    customerName: 'Customer C',
                    invoiceNumber: 'INV-503',
                    items: [{ description: 'Invoice 3', quantity: 1, unitPrice: 150, total: 150 }],
                    subTotal: 150,
                    total: 150,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    status: 'draft',
                },
            ]);
        });

        it('should count all invoices without filter', async () => {
            const count = await countInvoices({});

            expect(count).toBe(3);
        });

        it('should count invoices with filter', async () => {
            const count = await countInvoices({ user: 'user_123' });

            expect(count).toBe(2);
        });

        it('should count by status', async () => {
            const count = await countInvoices({ status: 'draft' });

            expect(count).toBe(2);
        });

        it('should return 0 if no matches', async () => {
            const count = await countInvoices({ user: 'user_nonexistent' });

            expect(count).toBe(0);
        });
    });

    describe('findCustomerByIdAndUser', () => {
        it('should find customer by id and user', async () => {
            const userId = 'user_123';
            const customer = await Customer.create({
                name: 'John Doe',
                email: 'john@example.com',
                users: [userId],
            });

            const found = await findCustomerByIdAndUser(customer._id, userId);

            expect(found).toBeDefined();
            expect(found._id.toString()).toBe(customer._id.toString());
            expect(found.name).toBe('John Doe');
        });

        it('should return null if customer not found', async () => {
            const found = await findCustomerByIdAndUser(new mongoose.Types.ObjectId(), 'user_123');

            expect(found).toBeNull();
        });

        it('should return null if user not in customer.users', async () => {
            const customer = await Customer.create({
                name: 'Jane Doe',
                email: 'jane@example.com',
                users: ['user_456'],
            });

            const found = await findCustomerByIdAndUser(customer._id, 'user_999');

            expect(found).toBeNull();
        });
    });

    describe('findCustomerByContact', () => {
        beforeEach(async () => {
            await Customer.create([
                { name: 'Alice Smith', email: 'alice@example.com', phone: '1234567890', users: [] },
                { name: 'Bob Jones', email: 'bob@example.com', phone: '0987654321', users: [] },
            ]);
        });

        it('should find customer by email', async () => {
            const found = await findCustomerByContact('alice@example.com', null);

            expect(found).toBeDefined();
            expect(found.name).toBe('Alice Smith');
        });

        it('should find customer by phone', async () => {
            const found = await findCustomerByContact(null, '0987654321');

            expect(found).toBeDefined();
            expect(found.name).toBe('Bob Jones');
        });

        it('should find customer by email (case insensitive)', async () => {
            const found = await findCustomerByContact('ALICE@EXAMPLE.COM', null);

            expect(found).toBeDefined();
            expect(found.name).toBe('Alice Smith');
        });

        it('should return null if both email and phone are null', async () => {
            const found = await findCustomerByContact(null, null);

            expect(found).toBeNull();
        });

        it('should return null if customer not found', async () => {
            const found = await findCustomerByContact('nonexistent@example.com', null);

            expect(found).toBeNull();
        });
    });

    describe('findCustomerByContactAndUser', () => {
        beforeEach(async () => {
            await Customer.create([
                { name: 'Charlie Brown', email: 'charlie@example.com', phone: '1111111111', users: ['user_123'] },
                { name: 'Diana Prince', email: 'diana@example.com', phone: '2222222222', users: ['user_456'] },
            ]);
        });

        it('should find customer by email and user', async () => {
            const found = await findCustomerByContactAndUser('charlie@example.com', null, 'user_123');

            expect(found).toBeDefined();
            expect(found.name).toBe('Charlie Brown');
        });

        it('should find customer by phone and user', async () => {
            const found = await findCustomerByContactAndUser(null, '2222222222', 'user_456');

            expect(found).toBeDefined();
            expect(found.name).toBe('Diana Prince');
        });

        it('should return null if user does not match', async () => {
            const found = await findCustomerByContactAndUser('charlie@example.com', null, 'user_999');

            expect(found).toBeNull();
        });

        it('should return null if both email and phone are null', async () => {
            const found = await findCustomerByContactAndUser(null, null, 'user_123');

            expect(found).toBeNull();
        });

        it('should find customer with case insensitive email', async () => {
            const found = await findCustomerByContactAndUser('DIANA@EXAMPLE.COM', null, 'user_456');

            expect(found).toBeDefined();
            expect(found.name).toBe('Diana Prince');
        });
    });

    describe('createCustomer', () => {
        it('should create new customer', async () => {
            const customerData = {
                name: 'Eva Green',
                email: 'eva@example.com',
                phone: '3333333333',
                users: ['user_789'],
            };

            const customer = await createCustomer(customerData);

            expect(customer).toBeDefined();
            expect(customer._id).toBeDefined();
            expect(customer.name).toBe('Eva Green');
            expect(customer.email).toBe('eva@example.com');
        });

        it('should save customer to database', async () => {
            const customerData = {
                name: 'Frank Castle',
                email: 'frank@example.com',
                users: [],
            };

            const created = await createCustomer(customerData);
            const found = await Customer.findById(created._id);

            expect(found).toBeDefined();
            expect(found.name).toBe('Frank Castle');
        });
    });

    describe('linkUserToCustomer', () => {
        it('should link user to customer', async () => {
            const customer = await Customer.create({
                name: 'Gary Oak',
                email: 'gary@example.com',
                users: [],
            });

            const linked = await linkUserToCustomer(customer, 'user_123');

            expect(linked.users).toContain('user_123');
        });

        it('should not duplicate existing user', async () => {
            const customer = await Customer.create({
                name: 'Hannah Montana',
                email: 'hannah@example.com',
                users: ['user_456'],
            });

            const linked = await linkUserToCustomer(customer, 'user_456');

            expect(linked.users).toHaveLength(1);
            expect(linked.users[0]).toBe('user_456');
        });

        it('should add user to existing array', async () => {
            const customer = await Customer.create({
                name: 'Ian Malcolm',
                email: 'ian@example.com',
                users: ['user_111'],
            });

            const linked = await linkUserToCustomer(customer, 'user_222');

            expect(linked.users).toHaveLength(2);
            expect(linked.users).toContain('user_111');
            expect(linked.users).toContain('user_222');
        });

        it('should handle null/undefined users array', async () => {
            const customer = await Customer.create({
                name: 'Julia Roberts',
                email: 'julia@example.com',
            });
            // Make users undefined
            customer.users = undefined;

            const linked = await linkUserToCustomer(customer, 'user_333');

            expect(linked.users).toContain('user_333');
        });
    });

    describe('findInvoiceByTempId', () => {
        it('should find invoice by clientTempId', async () => {
            const userId = 'user_123';
            const clientTempId = 'temp_12345';

            await Invoice.create({
                user: userId,
                customer: new mongoose.Types.ObjectId(),
                customerName: 'Test Customer',
                invoiceNumber: 'INV-601',
                items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
                subTotal: 100,
                total: 100,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
                clientTempId: clientTempId,
            });

            const found = await findInvoiceByTempId(userId, clientTempId);

            expect(found).toBeDefined();
            expect(found.clientTempId).toBe(clientTempId);
        });

        it('should return null if clientTempId is null', async () => {
            const found = await findInvoiceByTempId('user_123', null);

            expect(found).toBeNull();
        });

        it('should return null if clientTempId is undefined', async () => {
            const found = await findInvoiceByTempId('user_123', undefined);

            expect(found).toBeNull();
        });

        it('should return null if invoice not found', async () => {
            const found = await findInvoiceByTempId('user_123', 'non_existent_temp_id');

            expect(found).toBeNull();
        });

        it('should convert clientTempId to string', async () => {
            const userId = 'user_789';
            const clientTempId = 12345; // Number

            await Invoice.create({
                user: userId,
                customer: new mongoose.Types.ObjectId(),
                customerName: 'Test Customer',
                invoiceNumber: 'INV-602',
                items: [{ description: 'Test', quantity: 1, unitPrice: 100, total: 100 }],
                subTotal: 100,
                total: 100,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                status: 'draft',
                clientTempId: '12345',
            });

            const found = await findInvoiceByTempId(userId, clientTempId);

            expect(found).toBeDefined();
            expect(found.clientTempId).toBe('12345');
        });
    });

    describe('recalculateInvoiceTotals', () => {
        it('should recalculate invoice totals', () => {
            const invoice = {
                items: [
                    { description: 'Item 1', quantity: 2, unitPrice: 50, total: 100 },
                    { description: 'Item 2', quantity: 1, unitPrice: 75, total: 75 },
                ],
                subTotal: 0, // Old value
                tax: 10,
                total: 0, // Old value
            };

            const result = recalculateInvoiceTotals(invoice);

            expect(result.subTotal).toBe(175); // 100 + 75
            expect(result.total).toBe(185); // 175 + 10
        });

        it('should handle zero tax', () => {
            const invoice = {
                items: [
                    { description: 'Item 1', quantity: 1, unitPrice: 100, total: 100 },
                ],
                subTotal: 0,
                tax: 0,
                total: 0,
            };

            const result = recalculateInvoiceTotals(invoice);

            expect(result.subTotal).toBe(100);
            expect(result.total).toBe(100);
        });

        it('should handle null tax', () => {
            const invoice = {
                items: [
                    { description: 'Item 1', quantity: 1, unitPrice: 50, total: 50 },
                    { description: 'Item 2', quantity: 1, unitPrice: 30, total: 30 },
                ],
                subTotal: 0,
                tax: null,
                total: 0,
            };

            const result = recalculateInvoiceTotals(invoice);

            expect(result.subTotal).toBe(80);
            expect(result.total).toBe(80); // null tax treated as 0
        });

        it('should handle empty items array', () => {
            const invoice = {
                items: [],
                subTotal: 100,
                tax: 10,
                total: 110,
            };

            const result = recalculateInvoiceTotals(invoice);

            expect(result.subTotal).toBe(0);
            expect(result.total).toBe(10); // Only tax
        });

        it('should return modified invoice object', () => {
            const invoice = {
                items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
                subTotal: 0,
                tax: 5,
                total: 0,
            };

            const result = recalculateInvoiceTotals(invoice);

            expect(result).toBe(invoice); // Same object reference
        });
    });
});

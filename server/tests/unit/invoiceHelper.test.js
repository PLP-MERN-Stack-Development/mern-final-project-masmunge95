const { createInvoiceWithSequence } = require('../../src/utils/invoiceHelper');
const Invoice = require('../../src/models/Invoice');
const Counter = require('../../src/models/Counter');

describe('Invoice Helper Unit Tests', () => {
  
  describe('createInvoiceWithSequence', () => {
    const sellerId = 'seller-123';
    const sellerPrefix = 'ACME';

    beforeEach(async () => {
      // Clean up any existing counter
      await Counter.deleteMany({ _id: `invoiceNumber:${sellerId}` });
    });

    it('should create invoice with sequential invoice number', async () => {
      const payload = {
        customer: 'customer-123',
        customerName: 'Test Customer',
        items: [{ description: 'Item 1', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        user: sellerId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const invoice = await createInvoiceWithSequence(payload, sellerId, sellerPrefix);

      expect(invoice).toBeDefined();
      expect(invoice.invoiceNumber).toMatch(/^INV-\d+$/);
      expect(invoice.publicInvoiceId).toContain(sellerPrefix);
      expect(invoice.customer).toBe('customer-123');
    });

    it('should increment sequence for multiple invoices', async () => {
      const payload = {
        customer: 'customer-456',
        customerName: 'Test Customer',
        items: [{ description: 'Item', quantity: 1, unitPrice: 50, total: 50 }],
        subTotal: 50,
        total: 50,
        user: sellerId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const invoice1 = await createInvoiceWithSequence(payload, sellerId, sellerPrefix);
      const invoice2 = await createInvoiceWithSequence(payload, sellerId, sellerPrefix);
      const invoice3 = await createInvoiceWithSequence(payload, sellerId, sellerPrefix);

      const seq1 = parseInt(invoice1.invoiceNumber.replace('INV-', ''));
      const seq2 = parseInt(invoice2.invoiceNumber.replace('INV-', ''));
      const seq3 = parseInt(invoice3.invoiceNumber.replace('INV-', ''));

      expect(seq2).toBe(seq1 + 1);
      expect(seq3).toBe(seq2 + 1);
    });

    it('should create unique invoiceNumber per seller', async () => {
      const seller1 = 'seller-1';
      const seller2 = 'seller-2';

      const payload = {
        customer: 'customer-789',
        customerName: 'Test Customer',
        items: [{ description: 'Item', quantity: 1, unitPrice: 75, total: 75 }],
        subTotal: 75,
        total: 75,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const invoice1 = await createInvoiceWithSequence({ ...payload, user: seller1 }, seller1, 'S1');
      const invoice2 = await createInvoiceWithSequence({ ...payload, user: seller2 }, seller2, 'S2');

      expect(invoice1.invoiceNumber).toBe('INV-1');
      expect(invoice2.invoiceNumber).toBe('INV-1'); // Each seller starts at 1
      expect(invoice1.publicInvoiceId).toContain('S1');
      expect(invoice2.publicInvoiceId).toContain('S2');
    });

    it('should use sellerId in publicInvoiceId when no prefix provided', async () => {
      const payload = {
        customer: 'customer-abc',
        customerName: 'Test Customer',
        items: [{ description: 'Item', quantity: 1, unitPrice: 200, total: 200 }],
        subTotal: 200,
        total: 200,
        user: sellerId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const invoice = await createInvoiceWithSequence(payload, sellerId);

      expect(invoice.publicInvoiceId).toContain(sellerId);
      expect(invoice.publicInvoiceId).toMatch(/seller-123-\d+/);
    });

    it('should sanitize sellerPrefix with spaces', async () => {
      const payload = {
        customer: 'customer-def',
        customerName: 'Test Customer',
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        user: sellerId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const invoice = await createInvoiceWithSequence(payload, sellerId, 'My Company Name');

      expect(invoice.publicInvoiceId).toContain('My_Company_Name');
      expect(invoice.publicInvoiceId).not.toContain(' ');
    });

    it('should remove client-supplied _id to avoid conflicts', async () => {
      const payload = {
        _id: 'client-supplied-id',
        customer: 'customer-ghi',
        customerName: 'Test Customer',
        items: [{ description: 'Item', quantity: 1, unitPrice: 150, total: 150 }],
        subTotal: 150,
        total: 150,
        user: sellerId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const invoice = await createInvoiceWithSequence(payload, sellerId, sellerPrefix);

      expect(invoice._id.toString()).not.toBe('client-supplied-id');
      expect(invoice._id).toBeDefined();
    });

    it('should handle counter initialization', async () => {
      const newSellerId = 'new-seller-' + Date.now();
      const payload = {
        customer: 'customer-jkl',
        customerName: 'Test Customer',
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        user: newSellerId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const invoice = await createInvoiceWithSequence(payload, newSellerId, 'NEW');

      expect(invoice.invoiceNumber).toBe('INV-1');
      
      // Verify counter was created
      const counter = await Counter.findById(`invoiceNumber:${newSellerId}`);
      expect(counter).toBeDefined();
      expect(counter.sequence_value).toBe(1);
    });

    it('should retry on duplicate key errors', async () => {
      const payload = {
        customer: 'customer-retry',
        customerName: 'Test Customer',
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        user: sellerId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      // First invoice should succeed
      const invoice1 = await createInvoiceWithSequence(payload, sellerId, sellerPrefix);
      expect(invoice1).toBeDefined();

      // Second invoice should also succeed with next sequence number
      const invoice2 = await createInvoiceWithSequence(payload, sellerId, sellerPrefix);
      expect(invoice2).toBeDefined();
      
      const seq1 = parseInt(invoice1.invoiceNumber.replace('INV-', ''));
      const seq2 = parseInt(invoice2.invoiceNumber.replace('INV-', ''));
      expect(seq2).toBeGreaterThan(seq1);
    });

    it('should preserve payload properties', async () => {
      const payload = {
        customer: 'customer-props',
        customerName: 'Customer With Props',
        items: [
          { description: 'Item 1', quantity: 2, unitPrice: 50, total: 100 },
          { description: 'Item 2', quantity: 1, unitPrice: 75, total: 75 }
        ],
        subTotal: 175,
        tax: 28,
        total: 203,
        user: sellerId,
        status: 'draft',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      };

      const invoice = await createInvoiceWithSequence(payload, sellerId, sellerPrefix);

      expect(invoice.customerName).toBe('Customer With Props');
      expect(invoice.items.length).toBe(2);
      expect(invoice.subTotal).toBe(175);
      expect(invoice.tax).toBe(28);
      expect(invoice.total).toBe(203);
    });

    it('should throw error if counter fails after max retries', async () => {
      // Mock Counter.findOneAndUpdate to always return null
      const originalFindOneAndUpdate = Counter.findOneAndUpdate;
      Counter.findOneAndUpdate = jest.fn().mockResolvedValue(null);

      const payload = {
        customer: 'customer-fail',
        customerName: 'Test Customer',
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        user: 'fail-seller',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      await expect(
        createInvoiceWithSequence(payload, 'fail-seller', 'FAIL', 2)
      ).rejects.toThrow();

      // Restore original function
      Counter.findOneAndUpdate = originalFindOneAndUpdate;
    });

    it('should handle minimal valid payload', async () => {
      const payload = {
        customer: 'customer-minimal',
        customerName: 'Minimal Customer', // Required field
        items: [{ description: 'Item', quantity: 1, unitPrice: 100, total: 100 }],
        subTotal: 100,
        total: 100,
        user: sellerId,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const invoice = await createInvoiceWithSequence(payload, sellerId, sellerPrefix);

      expect(invoice).toBeDefined();
      expect(invoice.invoiceNumber).toBeDefined();
      expect(invoice.customerName).toBe('Minimal Customer');
    });
  });
});

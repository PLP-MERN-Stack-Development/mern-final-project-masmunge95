const mongoose = require('mongoose');
const Invoice = require('../../src/models/Invoice');
const Payment = require('../../src/models/Payment');
const PaymentLedger = require('../../src/models/PaymentLedger');
const SellerWallet = require('../../src/models/SellerWallet');
const Customer = require('../../src/models/Customer');
const { 
  processPaymentTransaction,
  createPaymentRecord,
  markInvoicePaid,
  updateSellerWallet,
  createLedgerEntry
} = require('../../src/services/payment/transaction/paymentTransactionService');

const testUserId = 'test-user-123';
let testCustomer;
let testInvoice;

// Mock session to avoid transaction issues
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn(),
  inTransaction: jest.fn().mockReturnValue(true),
};

describe('Payment Transaction Service Tests', () => {
  beforeEach(async () => {
    testCustomer = await Customer.create({
      user: testUserId,
      name: 'Test Customer',
      email: 'customer@example.com',
    });

    testInvoice = await Invoice.create({
      user: testUserId,
      customer: testCustomer._id,
      customerName: 'Test Customer',
      invoiceNumber: 'INV-TX-001',
      items: [{ description: 'Service', quantity: 1, unitPrice: 5000, total: 5000 }],
      subTotal: 5000,
      total: 5000,
      status: 'sent',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    jest.clearAllMocks();
  });

  describe('createPaymentRecord', () => {
    it('should create payment record with all required fields', async () => {
      const payment = await createPaymentRecord({
        invoiceId: testInvoice._id,
        customerId: testCustomer._id,
        userId: testUserId,
        amount: 5000,
        transactionId: 'TX-12345',
        session: null,
      });

      expect(payment).toBeDefined();
      expect(payment.invoice).toBe(testInvoice._id);
      expect(payment.customer).toBe(testCustomer._id);
      expect(payment.user).toBe(testUserId);
      expect(payment.amount).toBe(5000);
      expect(payment.transactionId).toBe('TX-12345');
      expect(payment.status).toBe('completed');
      expect(payment.provider).toBe('IntaSend');
    });

    it('should save payment to database', async () => {
      const payment = await createPaymentRecord({
        invoiceId: testInvoice._id,
        customerId: testCustomer._id,
        userId: testUserId,
        amount: 3000,
        transactionId: 'TX-67890',
        session: null,
      });

      const savedPayment = await Payment.findById(payment._id);
      expect(savedPayment).toBeDefined();
      expect(savedPayment.amount).toBe(3000);
    });

    it('should handle different transaction IDs', async () => {
      const payment1 = await createPaymentRecord({
        invoiceId: testInvoice._id,
        customerId: testCustomer._id,
        userId: testUserId,
        amount: 1000,
        transactionId: 'MPESA-123',
        session: null,
      });

      const payment2 = await createPaymentRecord({
        invoiceId: testInvoice._id,
        customerId: testCustomer._id,
        userId: testUserId,
        amount: 2000,
        transactionId: 'CARD-456',
        session: null,
      });

      expect(payment1.transactionId).toBe('MPESA-123');
      expect(payment2.transactionId).toBe('CARD-456');
    });
  });

  describe('markInvoicePaid', () => {
    it('should update invoice status to paid', async () => {
      await markInvoicePaid(testInvoice, null);

      const updatedInvoice = await Invoice.findById(testInvoice._id);
      expect(updatedInvoice.status).toBe('paid');
    });

    it('should persist status change', async () => {
      expect(testInvoice.status).toBe('sent');
      
      await markInvoicePaid(testInvoice, null);
      
      const reloaded = await Invoice.findById(testInvoice._id);
      expect(reloaded.status).toBe('paid');
    });
  });

  describe('updateSellerWallet', () => {
    it('should create wallet if not exists', async () => {
      const wallet = await updateSellerWallet(testUserId, 5000, null);

      expect(wallet).toBeDefined();
      expect(wallet.seller).toBe(testUserId);
      expect(wallet.pendingBalance).toBe(5000);
      expect(wallet.totalEarnings).toBe(5000);
    });

    it('should update existing wallet', async () => {
      await SellerWallet.create({
        seller: testUserId,
        availableBalance: 1000,
        pendingBalance: 500,
        totalEarnings: 1500,
      });

      const wallet = await updateSellerWallet(testUserId, 3000, null);

      expect(wallet.pendingBalance).toBe(3500); // 500 + 3000
      expect(wallet.totalEarnings).toBe(4500); // 1500 + 3000
    });

    it('should increment transaction stats', async () => {
      await SellerWallet.create({
        seller: testUserId,
        stats: { totalTransactions: 5 }
      });

      const wallet = await updateSellerWallet(testUserId, 2000, null);

      expect(wallet.stats.totalTransactions).toBe(6);
    });

    it('should update last payment date', async () => {
      const before = new Date();
      const wallet = await updateSellerWallet(testUserId, 1000, null);
      const after = new Date();

      expect(wallet.stats.lastPaymentDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(wallet.stats.lastPaymentDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should calculate average transaction value', async () => {
      await updateSellerWallet(testUserId, 1000, null);
      await updateSellerWallet(testUserId, 2000, null);
      const wallet = await updateSellerWallet(testUserId, 3000, null);

      expect(wallet.stats.averageTransactionValue).toBe(2000); // 6000 / 3
    });
  });

  describe('createLedgerEntry', () => {
    let payment;
    let wallet;

    beforeEach(async () => {
      payment = await createPaymentRecord({
        invoiceId: testInvoice._id,
        customerId: testCustomer._id,
        userId: testUserId,
        amount: 5000,
        transactionId: 'TX-LEDGER',
        session: null,
      });

      wallet = await updateSellerWallet(testUserId, 5000, null);
    });

    it.skip('should create ledger entry with correct data (requires PaymentLedger)', async () => {
      const ledger = await createLedgerEntry({
        paymentId: payment._id,
        intasendInvoiceId: testInvoice._id,
        intasendTransactionId: 'TX-INT-123',
        sellerId: testUserId,
        customerId: testCustomer._id,
        invoiceId: testInvoice._id,
        amount: 5000,
        currency: 'KES',
        wallet,
        invoice: testInvoice,
        isWebhook: true,
        session: null,
      });

      expect(ledger).toBeDefined();
      expect(ledger.seller).toBe(testUserId);
      expect(ledger.amount).toBe(5000);
      expect(ledger.currency).toBe('KES');
      expect(ledger.type).toBe('payment_received');
      expect(ledger.direction).toBe('credit');
    });

    it('should include metadata', async () => {
      const ledger = await createLedgerEntry({
        paymentId: payment._id,
        intasendInvoiceId: testInvoice._id,
        intasendTransactionId: 'TX-INT-456',
        sellerId: testUserId,
        customerId: testCustomer._id,
        invoiceId: testInvoice._id,
        amount: 3000,
        currency: 'KES',
        wallet,
        invoice: testInvoice,
        isWebhook: false,
        session: null,
      });

      expect(ledger.metadata.invoiceNumber).toBe('INV-TX-001');
      expect(ledger.metadata.paymentId).toBe(payment._id);
      expect(ledger.metadata.webhookProcessed).toBe(false);
      expect(ledger.metadata.manualVerification).toBe(true);
    });

    it('should calculate balance after', async () => {
      const ledger = await createLedgerEntry({
        paymentId: payment._id,
        intasendInvoiceId: testInvoice._id,
        intasendTransactionId: 'TX-INT-789',
        sellerId: testUserId,
        customerId: testCustomer._id,
        invoiceId: testInvoice._id,
        amount: 2000,
        currency: 'KES',
        wallet,
        invoice: testInvoice,
        isWebhook: true,
        session: null,
      });

      const expectedBalance = wallet.pendingBalance + wallet.availableBalance + wallet.heldBalance;
      expect(ledger.balanceAfter).toBe(expectedBalance);
    });
  });

  describe('processPaymentTransaction', () => {
    it('should process complete payment transaction', async () => {
      const verifiedData = {
        invoice: {
          invoice_id: testInvoice._id.toString(),
          value: 5000,
          id: 'INT-TX-12345',
          currency: 'KES',
          mpesa_reference: 'MPESA-REF-123',
        }
      };

      const payment = await processPaymentTransaction({
        invoice: testInvoice,
        verifiedData,
        isWebhook: true,
        session: null,
      });

      expect(payment).toBeDefined();

      // Verify invoice updated
      const updatedInvoice = await Invoice.findById(testInvoice._id);
      expect(updatedInvoice.status).toBe('paid');

      // Verify payment created
      const savedPayment = await Payment.findById(payment._id);
      expect(savedPayment).toBeDefined();

      // Verify wallet updated
      const wallet = await SellerWallet.findOne({ seller: testUserId });
      expect(wallet.totalEarnings).toBe(5000);

      // Verify ledger created
      const ledgers = await PaymentLedger.find({ seller: testUserId });
      expect(ledgers.length).toBeGreaterThan(0);
    });

    it('should handle different payment amounts', async () => {
      const verifiedData = {
        invoice: {
          invoice_id: testInvoice._id.toString(),
          value: 3500,
          id: 'INT-TX-67890',
          currency: 'USD',
          card_reference: 'CARD-REF-456',
        }
      };

      await processPaymentTransaction({
        invoice: testInvoice,
        verifiedData,
        isWebhook: false,
        session: null,
      });

      const wallet = await SellerWallet.findOne({ seller: testUserId });
      expect(wallet.totalEarnings).toBe(3500);
    });

    it('should track webhook vs manual verification', async () => {
      const verifiedData = {
        invoice: {
          invoice_id: testInvoice._id.toString(),
          value: 1000,
          id: 'INT-TX-MANUAL',
          currency: 'KES',
        }
      };

      await processPaymentTransaction({
        invoice: testInvoice,
        verifiedData,
        isWebhook: false,
        session: null,
      });

      const ledger = await PaymentLedger.findOne({ seller: testUserId });
      expect(ledger.metadata.webhookProcessed).toBe(false);
      expect(ledger.metadata.manualVerification).toBe(true);
    });
  });
});

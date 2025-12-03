const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Counter = require('../models/Counter');
const { createInvoiceWithSequence } = require('../utils/invoiceHelper');
const asyncHandler = require('../utils/asyncHandler');
const requireOwnership = require('../middleware/ownershipMiddleware');
const { clerkClient } = require('@clerk/clerk-sdk-node');

// Invoice service modules
const { findOrCreateCustomer, buildCustomerInvoiceData } = require('../services/invoice/crud/invoiceCustomerService');
const { findInvoiceByTempId, findInvoiceById, findInvoices, updateInvoiceById, deleteInvoiceById } = require('../services/invoice/crud/invoiceCrudService');
const {
  validateDates,
  extractCustomerContact,
  calculateTotals,
  getSellerMetadata,
  normalizeService,
  validateInvoiceUpdateAllowed,
  validateInvoiceSendAllowed,
  validateDisputeStatus,
  validateLineItemIndex
} = require('../services/invoice/validation/invoiceValidation');
const {
  isAuthorizedToDispute,
  isAuthorizedToResolve,
  isAuthorizedToViewDisputes,
  addDispute,
  resolveDispute,
  getDisputedInvoicesForSeller
} = require('../services/invoice/disputes/invoiceDisputeService');

/**
 * Generate the next invoice number for a specific user (seller).
 * This creates/separates counters per seller so each seller starts their own sequence.
 */
// keep a simple exported helper for legacy callers if needed
const getNextInvoiceNumber = async (userId) => {
    const counterId = `invoiceNumber:${userId}`;
    const counter = await Counter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
    );
    return `INV-${counter.sequence_value}`;
};

/**
 * @desc    Create a new invoice
 * @route   POST /api/invoices
 * @access  Private
 */
exports.createInvoice = asyncHandler(async (req, res) => {
    const { _id, customerId, items, tax, issueDate, dueDate, status } = req.body;
    const userId = req.auth.userId;

    if (!customerId || !items) {
        res.status(400);
        throw new Error('Please provide customerId and items.');
    }

    // Validate and normalize dates
    const { parsedIssueDate, parsedDueDate } = validateDates(issueDate, dueDate);

    // Extract customer contact information
    const customerContact = extractCustomerContact(req.body);

    // Find or create customer
    const customer = await findOrCreateCustomer({
        customerId,
        email: customerContact.email,
        phone: customerContact.phone,
        name: customerContact.name,
        userId
    });

    if (!customer) {
        res.status(404);
        throw new Error('Customer not found. Provide a valid customerId or include customerEmail/customerPhone in the payload.');
    }

    // Check for idempotency
    const clientTempId = req.body.clientTempId || req.body.tempId || null;
    const existingInvoice = await findInvoiceByTempId(userId, clientTempId);
    if (existingInvoice) {
        return res.status(200).json(existingInvoice);
    }

    // Calculate totals
    const { subTotal, total } = calculateTotals(items, tax);

    // Get seller metadata
    const { sellerName, sellerPrefix } = await getSellerMetadata(userId);

    // Normalize service field
    const normalizedService = normalizeService(req.body, items);

    const invoicePayload = {
        _id,
        customer: customer._id,
        customerName: customer.name,
        user: userId,
        sellerName,
        sellerPrefix,
        service: normalizedService || undefined,
        items,
        subTotal,
        tax: Number(tax) || 0,
        total,
        status,
        issueDate: parsedIssueDate,
        dueDate: parsedDueDate,
    };

    if (clientTempId) invoicePayload.clientTempId = String(clientTempId);

    const invoice = await createInvoiceWithSequence(invoicePayload, userId, sellerPrefix, 5);

    res.status(201).json(invoice);
});

/**
 * @desc    Get all invoices for the logged-in user
 * @route   GET /api/invoices
 * @access  Private
 */
exports.getInvoices = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;

    // Build filter object
    const filter = { user: userId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.customerId) filter.customer = req.query.customerId;
    
    // Filter by service
    if (req.query.service) {
        const svc = req.query.service;
        filter.$or = [
            { service: { $regex: svc, $options: 'i' } },
            { 'items.description': { $regex: svc, $options: 'i' } }
        ];
    }

    // Sync mode: return all invoices
    if (req.query.sync === 'true') {
        const allInvoices = await findInvoices(filter, { sort: { issueDate: -1 } });
        return res.status(200).json({
            invoices: allInvoices,
            total: allInvoices.length,
            pages: 1,
            page: 1,
        });
    }

    // Pagination mode
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const totalInvoices = await Invoice.countDocuments(filter);
    const invoices = await findInvoices(filter, { 
        sort: { issueDate: -1 }, 
        skip, 
        limit 
    });
        
    res.status(200).json({
        invoices,
        total: totalInvoices,
        page,
        pages: Math.ceil(totalInvoices / limit)
    });
});

/**
 * @desc    Get a single invoice by ID
 * @route   GET /api/invoices/:id
 * @access  Private
 */
exports.getInvoiceById = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const invoice = await requireOwnership(Invoice, req.params.id, userId, 'user');
    res.status(200).json(invoice);
});

/**
 * @desc    Update an invoice
 * @route   PUT /api/invoices/:id
 * @access  Private
 */
exports.updateInvoice = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    let invoice = await requireOwnership(Invoice, req.params.id, userId, 'user');
    
    // Validate invoice can be updated
    validateInvoiceUpdateAllowed(invoice);

    const { customerId, items, tax, dueDate, status } = req.body;

    // Recalculate totals if items are being updated
    if (items) {
        const { subTotal, total: newTotal } = calculateTotals(items, tax ?? invoice.tax);
        invoice.items = items;
        invoice.subTotal = subTotal;
        invoice.total = newTotal;
    }
    
    if (tax !== undefined) invoice.tax = tax;
    if (dueDate) invoice.dueDate = dueDate;
    if (status) invoice.status = status;
    
    // Update customer if provided
    if (customerId) {
        const customerContact = extractCustomerContact(req.body);
        const newCustomer = await findOrCreateCustomer({
            customerId,
            email: customerContact.email,
            phone: customerContact.phone,
            name: customerContact.name,
            userId
        });

        if (!newCustomer) {
            res.status(404);
            throw new Error('Customer not found for update. Provide a valid customerId or customer contact info.');
        }

        invoice.customer = newCustomer._id;
        invoice.customerName = newCustomer.name;
    }

    const updatedInvoice = await invoice.save();
    res.status(200).json(updatedInvoice);
});

/**
 * @desc    Delete an invoice
 * @route   DELETE /api/invoices/:id
 * @access  Private
 */
exports.deleteInvoice = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const invoice = await requireOwnership(Invoice, req.params.id, userId, 'user');

    if (invoice.status !== 'draft') {
        return res.status(400).json({ message: 'Only draft invoices can be deleted.' });
    }

    await deleteInvoiceById(req.params.id);
    res.status(200).json({ message: 'Invoice removed' });
});

/**
 * @desc    Send an invoice to a customer
 * @route   POST /api/invoices/:id/send
 * @access  Private
 */
exports.sendInvoice = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const invoice = await requireOwnership(Invoice, req.params.id, userId, 'user');

    // Validate invoice can be sent
    validateInvoiceSendAllowed(invoice);

    // TODO: Implement actual email sending logic here
    invoice.status = 'sent';
    const updatedInvoice = await invoice.save();

    res.status(200).json(updatedInvoice);
});

/**
 * @desc    Create a dispute on an invoice
 * @route   POST /api/invoices/:id/dispute
 * @access  Private (Customer)
 */
exports.createInvoiceDispute = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { lineItemIndex, field, originalValue, suggestedValue, reason } = req.body;
    const userId = req.auth.userId;

    if (!reason) {
        res.status(400);
        throw new Error('Please provide a reason for the dispute');
    }

    const invoice = await findInvoiceById(id);
    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    console.log('[DISPUTE DEBUG] Invoice ID:', invoice._id);
    console.log('[DISPUTE DEBUG] Invoice customer:', invoice.customer);
    console.log('[DISPUTE DEBUG] Invoice customer type:', typeof invoice.customer);
    console.log('[DISPUTE DEBUG] Current userId:', userId);

    // Check authorization (throws if not authorized)
    await isAuthorizedToDispute(invoice, userId, clerkClient);

    // Validate line item index if provided (throws if invalid)
    validateLineItemIndex(lineItemIndex, invoice.items);

    // Add dispute using service
    const disputeData = {
        userId,
        lineItemIndex: lineItemIndex ?? null,
        field: field || null,
        originalValue: originalValue || null,
        suggestedValue: suggestedValue || null,
        reason
    };
    
    addDispute(invoice, disputeData);
    await invoice.save();

    res.status(201).json({
        success: true,
        message: 'Dispute created successfully',
        invoice
    });
});

/**
 * @desc    Get all disputed invoices for current seller
 * @route   GET /api/invoices/disputed
 * @access  Private (Seller)
 */
exports.getDisputedInvoices = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const invoices = await getDisputedInvoicesForSeller(Invoice, userId);

    res.status(200).json({
        success: true,
        count: invoices.length,
        invoices
    });
});

/**
 * @desc    Resolve a dispute on an invoice
 * @route   PUT /api/invoices/:id/resolve-dispute
 * @access  Private (Seller)
 */
exports.resolveInvoiceDispute = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { disputeId, status, resolutionNotes, applyChanges } = req.body;
    const userId = req.auth.userId;

    // Validate status
    validateDisputeStatus(status);

    const invoice = await Invoice.findById(id);
    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    // Check authorization (throws if not authorized)
    await isAuthorizedToResolve(invoice, userId);

    // Resolve dispute using service
    const resolutionData = {
        disputeId,
        status,
        userId,
        resolutionNotes,
        applyChanges
    };
    
    resolveDispute(invoice, disputeId, resolutionData);
    await invoice.save();

    res.status(200).json({
        success: true,
        message: `Dispute ${status}`,
        invoice
    });
});

/**
 * @desc    Get disputes for a specific invoice
 * @route   GET /api/invoices/:id/disputes
 * @access  Private
 */
exports.getInvoiceDisputes = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.auth.userId;

    const invoice = await findInvoiceById(id);
    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found');
    }

    // Check authorization (throws if not authorized)
    await isAuthorizedToViewDisputes(invoice, userId, clerkClient);

    res.status(200).json({
        success: true,
        disputes: invoice.disputes,
        disputeStatus: invoice.disputeStatus
    });
});

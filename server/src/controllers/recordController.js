const Record = require('../models/Record');
const asyncHandler = require('../utils/asyncHandler');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const requireOwnership = require('../middleware/ownershipMiddleware');

// Service imports
const { findRecordById, findRecords, createRecord, updateRecordById, deleteRecordById, countRecords, findRecordsSharedWith, findRecordsSharedBy } = require('../services/record/crud/recordCrudService');
const { processOcrBilling, parseOcrData } = require('../services/record/crud/recordBillingService');
const { validateConversionRequirements, buildInvoicePayload } = require('../services/record/conversion/recordConversionService');
const { validateShareRequirements, isAuthorizedToShare, addRecipientsToRecord, isAuthorizedToView } = require('../services/record/sharing/recordSharingService');
const { validateVerificationStatus, validateResolutionStatus, isAuthorizedToVerify, isAuthorizedToViewVerifications, isAuthorizedToResolveDisputes, addOrUpdateVerification, findVerificationById, resolveDispute, applySuggestedCorrections } = require('../services/record/verification/recordVerificationService');

/**
 * @desc    Create a new record (sale or expense)
 * @route   POST /api/records
 * @access  Private
 */
exports.createRecord = asyncHandler(async (req, res) => {
    const { _id, type, amount, description, customerId, recordDate, recordType, ocrData, modelSpecs, customerName, customerPhone } = req.body;
    const userId = req.auth.userId;

    if (!_id) {
        res.status(400);
        throw new Error('Please provide _id.');
    }

    // Parse OCR data
    const parsedOcr = parseOcrData(ocrData);

    // Process OCR billing
    const { analysisId, uploaderType, isCustomerSubmission } = req.body;
    const role = req.auth?.sessionClaims?.metadata?.role || req.auth?.sessionClaims?.role || null;
    const isSeller = role === 'seller';
    
    try {
        await processOcrBilling({
            analysisId,
            sellerId: userId,
            uploaderType,
            isCustomerSubmission: isCustomerSubmission === 'true' || isCustomerSubmission === true,
            hasOcrData: !!parsedOcr,
            isSeller
        });
    } catch (err) {
        console.error('[Billing] Error processing OCR billing during record create:', err);
    }

    const recordPayload = {
        _id,
        type: type || null,
        recordType: recordType || 'business-record',
        amount: amount !== undefined && amount !== null ? amount : null,
        description: description || (parsedOcr?.extracted?.businessName || ''),
        // allow explicit customerName/customerPhone or fallback to parsed OCR
        customerName: customerName || parsedOcr?.customerName || parsedOcr?.extracted?.customerName || parsedOcr?.extracted?.customer || '',
        customerPhone: customerPhone || parsedOcr?.customerPhone || parsedOcr?.mobileNumber || '',
        customer: customerId || null,
        recordDate: recordDate || undefined,
        user: userId,
        // Prefer existing imagePath from OCR upload, fallback to new file upload
        imagePath: req.body.imagePath || (req.file ? `/${req.file.path.replace(/\\/g, '/')}` : undefined),
        ocrData: parsedOcr || undefined,
        extracted: parsedOcr?.extracted || null,
        rawText: parsedOcr?.rawText || null,
        docType: parsedOcr?.docType || null,
        docConfidence: parsedOcr?.docConfidence || null,
        metadata: parsedOcr?.metadata || null,
        syncStatus: parsedOcr ? 'complete' : 'pending',
        modelSpecs: modelSpecs ? JSON.parse(modelSpecs) : undefined,
    };

    const record = await Record.create(recordPayload);

    res.status(201).json(record);
});

/**
 * @desc    Get all records for the logged-in user
 * @route   GET /api/records
 * @access  Private
 */
exports.getRecords = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const records = await findRecords({ user: userId }, { sort: { recordDate: -1 } });
    
    res.status(200).json(records);
});

/**
 * @desc    Get a single record by ID
 * @route   GET /api/records/:id
 * @access  Private
 */
exports.getRecordById = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const record = await requireOwnership(Record, req.params.id, userId, 'user');
    res.status(200).json(record);
});

/**
 * @desc    Update a record
 * @route   PUT /api/records/:id
 * @access  Private
 */
exports.updateRecord = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    let record = await requireOwnership(Record, req.params.id, userId, 'user');

    const { type, amount, description, customer, recordDate, customerName, customerPhone, tables, ocrData: ocrDataRaw, extracted } = req.body;

    record.type = type ?? record.type;
    record.amount = amount ?? record.amount;
    record.description = description ?? record.description;
    record.customer = customer ?? record.customer;
    record.recordDate = recordDate ?? record.recordDate;
    // persist display-friendly customer fields when provided
    record.customerName = typeof customerName !== 'undefined' ? customerName : record.customerName;
    record.customerPhone = typeof customerPhone !== 'undefined' ? customerPhone : record.customerPhone;

    // Persist user-edits to detected tables (including user-supplied table.name)
    if (typeof tables !== 'undefined') {
        try {
            record.tables = Array.isArray(tables) ? tables : JSON.parse(tables);
        } catch (e) {
            // If parsing fails, ignore and leave existing tables
            console.warn('Failed to parse tables payload for record update', e);
        }
    }

    // Allow the client to send back updated OCR payload or extracted fields
    if (typeof ocrDataRaw !== 'undefined') {
        try {
            record.ocrData = typeof ocrDataRaw === 'string' ? JSON.parse(ocrDataRaw) : ocrDataRaw;
            record.markModified('ocrData'); // Required for Mixed type fields
        } catch (e) {
            console.warn('Failed to parse ocrData payload for record update', e);
        }
    }
    if (typeof extracted !== 'undefined') {
        record.extracted = extracted;
        record.markModified('extracted'); // Required for Mixed type fields
    }

    const updatedRecord = await record.save();

    res.status(200).json(updatedRecord);
});

/**
 * @desc    Delete a record
 * @route   DELETE /api/records/:id
 * @access  Private
 */
exports.deleteRecord = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const record = await requireOwnership(Record, req.params.id, userId, 'user');
    await record.deleteOne(); // Using deleteOne() on the document
    res.status(200).json({ message: 'Record removed' });
});

/**
 * @desc    Convert a Record into an Invoice
 * @route   POST /api/records/:id/convert-to-invoice
 * @access  Private (seller or admin)
 */
exports.convertRecordToInvoice = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const recordId = req.params.id;

    // Verify record ownership
    const record = await requireOwnership(Record, recordId, userId, 'user');

    // Prevent double-conversion
    if (record.linkedInvoiceId) {
        res.status(400);
        throw new Error('Record has already been converted to an invoice.');
    }

    // Prefer explicit customerId from request body (user mapping step), fallback to record.customer
    const customerId = req.body.customerId || record.customer;
    if (!customerId) {
        res.status(400);
        throw new Error('Cannot convert record: no customer specified. Provide `customerId` to map this record to a customer.');
    }

    // Verify the customer belongs to / is linked to the user
    const customer = await Customer.findOne({ _id: customerId, users: userId });
    if (!customer) {
        res.status(404);
        throw new Error('Customer not found or does not belong to the authenticated user.');
    }

    // Build invoice items from record.extracted or fallback to single-line from amount
    const extracted = record.extracted || {};
    let items = [];
    if (Array.isArray(extracted.lineItems) && extracted.lineItems.length > 0) {
        items = extracted.lineItems.map(li => ({
            description: li.description || li.name || 'Item',
            quantity: Number(li.quantity) || 1,
            unitPrice: Number(li.unitPrice || li.price || li.unit_amount || li.rate) || Number(li.total) || 0,
            total: Number(li.total) || (Number(li.quantity) || 1) * (Number(li.unitPrice || li.price || li.unit_amount || li.rate) || 0),
        }));
    } else if (Array.isArray(extracted.items) && extracted.items.length > 0) {
        items = extracted.items.map(li => ({
            description: li.description || li.name || 'Item',
            quantity: Number(li.quantity) || 1,
            unitPrice: Number(li.unitPrice || li.price || li.rate) || Number(li.total) || 0,
            total: Number(li.total) || (Number(li.quantity) || 1) * (Number(li.unitPrice || li.price || li.rate) || 0),
        }));
    } else if (record.amount || extracted.total || extracted.amount) {
        const amt = Number(record.amount || extracted.total || extracted.amount || 0);
        items = [{ description: record.description || extracted.description || 'Service', quantity: 1, unitPrice: amt, total: amt }];
    } else {
        res.status(400);
        throw new Error('Unable to build invoice items from record. Please supply items or an amount.');
    }

    // Tax and totals
    const tax = typeof req.body.tax !== 'undefined' ? Number(req.body.tax) : (extracted.tax || 0);
    const subTotal = items.reduce((s, it) => s + (Number(it.total) || 0), 0);
    const total = subTotal + (Number(tax) || 0);

    // Dates
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create invoice using helper that atomically assigns a per-seller sequence
    // populate seller metadata
    let sellerName = userId;
    let sellerPrefix = userId ? String(userId).slice(0, 8) : null;
    try {
        const seller = await clerkClient.users.getUser(userId);
        if (seller) {
            const first = seller?.firstName || '';
            const last = seller?.lastName || '';
            sellerName = (first || last) ? `${first} ${last}`.trim() : (seller?.publicMetadata?.businessName || seller?.publicMetadata?.organization || (seller.emailAddresses && seller.emailAddresses[0] && seller.emailAddresses[0].emailAddress) || userId);
            sellerPrefix = seller?.publicMetadata?.sellerPrefix || (userId ? String(userId).slice(0, 8) : sellerPrefix);
        }
    } catch (e) {
        // ignore and fallback
    }

    const invoicePayload = {
        customer: customerId,
        customerName: customer.name,
        user: userId,
        sellerName,
        sellerPrefix,
        service: (req.body.service || (items && items[0] && items[0].description) || '').toString().trim() || undefined,
        items,
        subTotal,
        tax,
        total,
        status: req.body.status || 'draft',
        issueDate,
        dueDate,
    };

    const { createInvoiceWithSequence } = require('../utils/invoiceHelper');
    const invoice = await createInvoiceWithSequence(invoicePayload, userId, sellerPrefix, 5);

    // Link record -> invoice
    record.linkedInvoiceId = invoice._id;
    await record.save();

    res.status(201).json({ invoice, recordId: record._id });
});

/**
 * @desc    Share a record with customers or sellers
 * @route   POST /api/records/:id/share
 * @access  Private
 */
exports.shareRecord = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { recipientIds, role } = req.body;
    const userId = req.auth.userId;

    // Validate requirements
    validateShareRequirements(recipientIds, role);

    const record = await findRecordById(id);
    if (!record) {
        res.status(404);
        throw new Error('Record not found');
    }

    // Check authorization
    if (!isAuthorizedToShare(record, userId, role)) {
        res.status(403);
        throw new Error('Not authorized to share this record');
    }

    // Add recipients
    addRecipientsToRecord(record, recipientIds, userId, role);
    await record.save();

    res.status(200).json({
        success: true,
        message: `Record shared with ${recipientIds.length} recipient(s)`,
        record
    });
});

/**
 * @desc    Get records shared with current user
 * @route   GET /api/records/shared-with-me
 * @access  Private
 */
exports.getSharedWithMe = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const records = await findRecordsSharedWith(userId);

    res.status(200).json({
        success: true,
        count: records.length,
        records
    });
});

/**
 * @desc    Get records shared by current user
 * @route   GET /api/records/shared-by-me
 * @access  Private
 */
exports.getSharedByMe = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const records = await findRecordsSharedBy(userId);

    res.status(200).json({
        success: true,
        count: records.length,
        records
    });
});

/**
 * @desc    Verify or dispute a record
 * @route   POST /api/records/:id/verify
 * @access  Private
 */
exports.verifyRecord = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, suggestedCorrections, comments } = req.body;
    const userId = req.auth.userId;
    const userRole = req.auth?.sessionClaims?.metadata?.role || req.auth?.sessionClaims?.role || 'customer';

    // Validate status
    validateVerificationStatus(status);

    const record = await findRecordById(id);
    if (!record) {
        res.status(404);
        throw new Error('Record not found');
    }

    // Check authorization
    if (!isAuthorizedToVerify(record, userId)) {
        res.status(403);
        throw new Error('Not authorized to verify this record');
    }

    // Add or update verification
    addOrUpdateVerification(record, userId, { status, notes: comments, suggestedCorrections }, userRole);
    await record.save();

    res.status(200).json({
        success: true,
        message: `Record ${status}`,
        record
    });
});

/**
 * @desc    Get verifications for a record
 * @route   GET /api/records/:id/verifications
 * @access  Private
 */
exports.getRecordVerifications = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.auth.userId;

    const record = await findRecordById(id);
    if (!record) {
        res.status(404);
        throw new Error('Record not found');
    }

    // Check authorization
    if (!isAuthorizedToViewVerifications(record, userId)) {
        res.status(403);
        throw new Error('Not authorized to view verifications');
    }

    res.status(200).json({
        success: true,
        verifications: record.verifications
    });
});

/**
 * @desc    Resolve a dispute on a record
 * @route   PUT /api/records/:id/resolve-dispute
 * @access  Private
 */
exports.resolveRecordDispute = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { verificationId, resolution, resolutionNotes, acceptCorrections } = req.body;
    const userId = req.auth.userId;

    // Validate resolution
    validateResolutionStatus(resolution);

    const record = await findRecordById(id);
    if (!record) {
        res.status(404);
        throw new Error('Record not found');
    }

    // Check authorization
    if (!isAuthorizedToResolveDisputes(record, userId)) {
        res.status(403);
        throw new Error('Not authorized to resolve disputes');
    }

    // Find verification
    const verification = findVerificationById(record, verificationId);
    if (!verification) {
        res.status(404);
        throw new Error('Verification not found');
    }

    if (verification.status !== 'disputed') {
        res.status(400);
        throw new Error('This verification is not in disputed status');
    }

    // Resolve dispute
    resolveDispute(verification, { resolution, resolutionNotes }, userId);

    // Apply corrections if accepted
    if (resolution === 'accepted' && acceptCorrections && verification.suggestedCorrections) {
        applySuggestedCorrections(record, verification.suggestedCorrections);
    }

    await record.save();

    res.status(200).json({
        success: true,
        message: `Dispute ${resolution}`,
        record
    });
});

const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const { clerkClient } = require('@clerk/clerk-sdk-node');

/**
 * @desc    Get all invoices for the logged-in customer
 * @route   GET /api/portal/invoices
 * @access  Private (for the logged-in customer)
 */
exports.getMyInvoices = asyncHandler(async (req, res) => {
    const { userId } = req.auth;
    const user = await clerkClient.users.getUser(userId);

    if (!user || !user.emailAddresses || user.emailAddresses.length === 0) {
        console.warn('Primary email address not found in authentication token. Returning empty array for portal invoices.');
        return res.status(200).json([]);
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Find the customer profile that matches the logged-in user's email.
    // A user might be a customer of multiple sellers, so we find all profiles.
    const customerProfiles = await Customer.find({ email: userEmail });

    if (!customerProfiles || customerProfiles.length === 0) {
        // This is a valid case where a user is logged in but hasn't been created as a customer by any seller yet.
        return res.status(200).json([]);
    }

    const customerIds = customerProfiles.map(p => p._id);

    // Build base filter
    const filter = {
        customer: { $in: customerIds },
        status: { $in: ['sent', 'paid', 'overdue'] },
    };

    // Optional filtering by seller (name or prefix)
    if (req.query.seller) {
        const s = req.query.seller;
        filter.$or = filter.$or || [];
        filter.$or.push({ sellerName: { $regex: s, $options: 'i' } });
        filter.$or.push({ sellerPrefix: { $regex: s, $options: 'i' } });
    }

    // Optional filtering by service (normalized service field or item descriptions)
    if (req.query.service) {
        const svc = req.query.service;
        filter.$or = filter.$or || [];
        filter.$or.push({ service: { $regex: svc, $options: 'i' } });
        filter.$or.push({ 'items.description': { $regex: svc, $options: 'i' } });
    }

    const invoices = await Invoice.find(filter).sort({ issueDate: -1 });
    
    res.status(200).json(invoices);
});

/**
 * @desc    Get a single invoice by ID for the logged-in customer
 * @route   GET /api/portal/invoices/:id
 * @access  Private (for the logged-in customer)
 */
exports.getMyInvoiceById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { userId } = req.auth;
    const user = await clerkClient.users.getUser(userId);
    
    if (!user || !user.emailAddresses || user.emailAddresses.length === 0) {
        res.status(404);
        throw new Error('Customer profile not found.');
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Find all customer profiles associated with this email
    const customerProfiles = await Customer.find({ email: userEmail });

    if (!customerProfiles || customerProfiles.length === 0) {
        res.status(404);
        throw new Error('Customer profile not found.');
    }

    const customerIds = customerProfiles.map(p => p._id);

    const invoice = await Invoice.findOne({
        _id: id,
        customer: { $in: customerIds },
        status: { $in: ['sent', 'paid', 'overdue'] } // Customers can only see sent invoices
    });

    if (!invoice) {
        res.status(404);
        throw new Error('Invoice not found or access denied.');
    }

    res.status(200).json(invoice);
});

/**
 * @desc    Get allowed sellers for the logged-in customer
 * @route   GET /api/portal/sellers
 * @access  Private (logged-in customer)
 */
exports.getMySellers = asyncHandler(async (req, res) => {
    const { userId } = req.auth;
    const user = await clerkClient.users.getUser(userId);

    if (!user || !user.emailAddresses || user.emailAddresses.length === 0) {
        return res.status(200).json([]);
    }
    const userEmail = user.emailAddresses[0].emailAddress;

    // Find all customer profiles associated with this email
    const customerProfiles = await Customer.find({ email: userEmail });
    if (!customerProfiles || customerProfiles.length === 0) {
        return res.status(200).json([]);
    }

    const customerIds = customerProfiles.map(p => p._id);

    // Collect seller user IDs from Customer.users fields
    const sellerIdSet = new Set();
    customerProfiles.forEach(p => {
        if (Array.isArray(p.users)) p.users.forEach(u => { if (u) sellerIdSet.add(u); });
    });

    // Also include any sellers who have invoices for these customer profiles
    try {
        const invoiceSellers = await require('../models/Invoice').distinct('user', { customer: { $in: customerIds } });
        if (Array.isArray(invoiceSellers)) invoiceSellers.forEach(sid => { if (sid) sellerIdSet.add(sid); });
    } catch (e) {
        // non-fatal; continue with customer.users-derived sellers
        console.warn('[Portal] failed to query invoice sellers', e);
    }

    const sellerIds = Array.from(sellerIdSet);
    console.debug('[Portal] resolving sellers for sellerIds:', sellerIds, 'customerProfiles:', customerProfiles.map(p => p._id));

    // Resolve Clerk user profiles for each seller id when possible.
    // Use Promise.allSettled and per-call timeouts to avoid long hangs or a single failure
    // causing the entire request to stall or reject.
    const clerkLookupWithTimeout = async (sid, ms = 5000) => {
        return new Promise(async (resolve) => {
            let settled = false;
            // Timeout fallback
            const t = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    resolve({ sellerId: sid, name: null, invoicePrefix: null, _timedOut: true });
                }
            }, ms);
            try {
                const profile = await clerkClient.users.getUser(sid);
                if (!settled) {
                    clearTimeout(t);
                    settled = true;
                    resolve({
                        sellerId: sid,
                        name: (profile && ((profile.publicMetadata && profile.publicMetadata.businessName) || profile.firstName || profile.username)) || null,
                        invoicePrefix: (profile && profile.publicMetadata && profile.publicMetadata.invoicePrefix) || null,
                    });
                }
            } catch (e) {
                if (!settled) {
                    clearTimeout(t);
                    settled = true;
                    resolve({ sellerId: sid, name: null, invoicePrefix: null, _error: true });
                }
            }
        });
    };

    const sellerPromises = sellerIds.map(sid => clerkLookupWithTimeout(sid, 5000));
    const sellersSettled = await Promise.allSettled(sellerPromises);
    const sellers = sellersSettled.map(r => (r.status === 'fulfilled' && r.value) ? r.value : { sellerId: null, name: null, invoicePrefix: null });

    // Attach available services for each seller (if any)
    try {
        const UtilityService = require('../models/UtilityService');
        const services = await UtilityService.find({ user: { $in: sellerIds } }).lean();
        const servicesByUser = services.reduce((acc, s) => {
            if (!acc[s.user]) acc[s.user] = [];
            acc[s.user].push({ id: s._id, name: s.name, unitPrice: s.unitPrice });
            return acc;
        }, {});
        // merge services into sellers
        const sellersWithServices = sellers.map(s => ({ ...s, services: servicesByUser[s.sellerId] || [] }));
        console.debug('[Portal] sellersWithServices preview:', sellersWithServices);
        return res.status(200).json(sellersWithServices);
    } catch (err) {
        // If service lookup fails, return sellers without services
        console.warn('[Portal] failed to load services for sellers', err);
        return res.status(200).json(sellers);
    }
});
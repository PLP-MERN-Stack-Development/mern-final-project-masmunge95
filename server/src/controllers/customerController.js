const Customer = require('../models/Customer');
const asyncHandler = require('../utils/asyncHandler');
const requireOwnership = require('../middleware/ownershipMiddleware');

/**
 * @desc    Create a new customer
 * @route   POST /api/customers
 * @access  Private
 */
exports.createCustomer = asyncHandler(async (req, res) => {
    const { _id, name, phone, email } = req.body;
    const userId = req.auth.userId;

    if (!name) {
        res.status(400);
        throw new Error('Please provide a customer name.');
    }

    // Check if customer with the same phone or email already exists for this user
    const query = { users: userId, $or: [] };
    if (phone) query.$or.push({ phone });
    if (email) query.$or.push({ email });

    if (query.$or.length > 0) {
        const existingCustomer = await Customer.findOne(query);
        if (existingCustomer) {
            res.status(400);
            throw new Error('Customer with this phone or email already exists.');
        }
    }

    try {
        const customer = await Customer.create({
            _id: _id || undefined,
            name,
            phone,
            email,
            users: [userId],
        });
        return res.status(201).json(customer);
    } catch (err) {
        // If a duplicate-key error exists on a global unique index (e.g., email_1)
        // attempt to recover by finding the existing customer and linking the current user.
        const isDuplicateKey = err && (err.code === 11000 || (err.message && err.message.includes('duplicate')));
        if (isDuplicateKey) {
            try {
                // Try to locate the existing customer by email or phone
                let existing = null;
                if (email) existing = await Customer.findOne({ email: email.toLowerCase() });
                if (!existing && phone) existing = await Customer.findOne({ phone });

                if (existing) {
                    if (!Array.isArray(existing.users) || !existing.users.includes(userId)) {
                        existing.users = Array.from(new Set([...(existing.users || []), userId]));
                        await existing.save();
                    }
                    return res.status(200).json(existing);
                }
            } catch (linkErr) {
                // fall through to throw original error below
            }
        }
        // Unknown error — rethrow so centralized handler returns proper status
        throw err;
    }
});

/**
 * @desc    Get all customers for the logged-in user
 * @route   GET /api/customers
 * @access  Private
 */
exports.getCustomers = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;

    // Match customers where the `users` array contains the current user
    // Include ALL customers (active and inactive) so historical records can show customer names
    // even if the customer was later soft-deleted
    const customers = await Customer.find({
        users: userId
    }).sort({ name: 1 });

    // DEV-only diagnostics: when no customers are found, log helpful info to
    // help debug owner-linking or flag-migration problems (only run outside production).
    if (process.env.NODE_ENV !== 'production' && (!customers || customers.length === 0)) {
        try {
            console.debug('[customerController] DEBUG: getCustomers returned 0 items for userId:', userId);
            // Log how many total customers exist (quick sanity) and a small sample
            const total = await Customer.countDocuments({}).exec();
            const sample = await Customer.find({}).limit(5).select('_id users name email isActive').lean().exec();
            console.debug(`[customerController] DEBUG: total customers in DB: ${total}; sample (up to 5):`, sample);
        } catch (dbgErr) {
            console.warn('[customerController] DEBUG: failed to collect diagnostic sample', dbgErr);
        }
    }

    res.status(200).json(customers);
});

/**
 * @desc    Get a single customer by ID
 * @route   GET /api/customers/:id
 * @access  Private
 */
exports.getCustomerById = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const customer = await requireOwnership(Customer, req.params.id, userId, 'users');
    if (!customer || customer.isActive === false) {
        res.status(404);
        throw new Error('Customer not found.');
    }
    res.status(200).json(customer);
});

/**
 * @desc    Update a customer
 * @route   PUT /api/customers/:id
 * @access  Private
 */
exports.updateCustomer = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    let customer = await requireOwnership(Customer, req.params.id, userId, 'users');

    const { name, phone, email } = req.body;
    customer.name = name ?? customer.name;
    customer.phone = phone ?? customer.phone;
    customer.email = email ?? customer.email;

    const updatedCustomer = await customer.save();

    res.status(200).json(updatedCustomer);
});

/**
 * @desc    Delete a customer
 * @route   DELETE /api/customers/:id
 * @access  Private
 */
exports.deleteCustomer = asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const customer = await requireOwnership(Customer, req.params.id, userId, 'users');
    // Soft delete the customer by setting isActive to false
    customer.isActive = false;
    await customer.save();
    res.status(200).json({ message: 'Customer deactivated' });
});

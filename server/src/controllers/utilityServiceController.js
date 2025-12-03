const UtilityService = require('../models/UtilityService');
const asyncHandler = require('../utils/asyncHandler');
const requireOwnership = require('../middleware/ownershipMiddleware');

// @desc    Get all utility services for the logged-in user
// @route   GET /api/services
// @access  Private (Seller)
exports.getServices = asyncHandler(async (req, res) => {
  const { search } = req.query;
  
  let query = { user: req.auth.userId };
  
  // Add search functionality if search parameter provided
  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }
  
  const services = await UtilityService.find(query);
  res.status(200).json(services);
});

// @desc    Create a new utility service
// @route   POST /api/services
// @access  Private (Seller)
exports.createService = asyncHandler(async (req, res) => {
  const { _id, name, details, unitPrice, fees } = req.body;
  
  if (!_id) {
    res.status(400);
    throw new Error('Please provide _id.');
  }
  
  // Check for duplicate service name for this user
  const existingService = await UtilityService.findOne({ name, user: req.auth.userId });
  if (existingService) {
    res.status(400);
    throw new Error('A service with this name already exists.');
  }
  
  const service = new UtilityService({
    _id,
    name,
    details,
    unitPrice,
    fees,
    user: req.auth.userId,
  });
  const createdService = await service.save();
  res.status(201).json(createdService);
});

// @desc    Get a single utility service by ID
// @route   GET /api/services/:id
// @access  Private (Seller)
exports.getServiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Validate ID format - allow UUID, custom format (service-*), or MongoDB ObjectId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
  const isValidFormat = uuidRegex.test(id) || id.startsWith('service-') || mongoIdRegex.test(id);
  
  if (!isValidFormat) {
    res.status(400);
    throw new Error('Invalid service ID format');
  }
  
  const service = await requireOwnership(UtilityService, id, req.auth.userId, 'user');
  res.status(200).json(service);
});

// @desc    Update a utility service
// @route   PUT /api/services/:id
// @access  Private (Seller)
exports.updateService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Validate ID format - allow UUID, custom format (service-*), or MongoDB ObjectId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
  const isValidFormat = uuidRegex.test(id) || id.startsWith('service-') || mongoIdRegex.test(id);
  
  if (!isValidFormat) {
    res.status(400);
    throw new Error('Invalid service ID format');
  }
  
  const service = await requireOwnership(UtilityService, id, req.auth.userId, 'user');

  const { name, details, unitPrice, fees } = req.body;
  service.name = name || service.name;
  service.details = details || service.details;
  service.unitPrice = unitPrice !== undefined ? unitPrice : service.unitPrice;
  service.fees = fees || service.fees;

  const updatedService = await service.save();
  res.status(200).json(updatedService);
});

// @desc    Delete a utility service
// @route   DELETE /api/services/:id
// @access  Private (Seller)
exports.deleteService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Validate ID format - allow UUID, custom format (service-*), or MongoDB ObjectId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const mongoIdRegex = /^[0-9a-fA-F]{24}$/;
  const isValidFormat = uuidRegex.test(id) || id.startsWith('service-') || mongoIdRegex.test(id);
  
  if (!isValidFormat) {
    res.status(400);
    throw new Error('Invalid service ID format');
  }
  
  const service = await requireOwnership(UtilityService, id, req.auth.userId, 'user');
  await service.deleteOne();
  res.status(200).json({ message: 'Service removed' });
});
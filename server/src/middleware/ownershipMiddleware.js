/**
 * requireOwnership helper
 * Usage: const requireOwnership = require('../middleware/ownershipMiddleware');
 * In controller: await requireOwnership(Model, req.params.id, req.auth.userId, 'user')
 * - Model: Mongoose model
 * - id: document id to look up
 * - ownerId: currently authenticated user id
 * - ownerField: field name on the document that references the owner (default 'user')
 * Returns the found document or throws a 404/403 error when not found or not owned.
 */
const mongoose = require('mongoose');

class OwnershipError extends Error {}

module.exports = async function requireOwnership(Model, id, ownerId, ownerField = 'user') {
  if (!id) {
    const err = new Error('Missing id for ownership check');
    err.status = 400;
    throw err;
  }

  if (!ownerId) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  // Allow UUIDs or Mongo ObjectIds
  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const query = isObjectId ? { _id: id } : { _id: id };
  query[ownerField] = ownerId;

  const doc = await Model.findOne(query).exec();
  if (!doc) {
    const err = new Error('Not found or access denied');
    err.status = 404;
    throw err;
  }

  return doc;
};

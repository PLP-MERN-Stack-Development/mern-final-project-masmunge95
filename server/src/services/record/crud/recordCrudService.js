const Record = require('../../../models/Record');

/**
 * Find a record by ID with optional population
 * @param {string} id - Record ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
async function findRecordById(id, options = {}) {
    let query = Record.findById(id);
    if (options.populate) {
        query = query.populate(options.populate);
    }
    return query.exec();
}

/**
 * Find records with filters
 * @param {Object} filter - MongoDB filter object
 * @param {Object} options - Query options (sort, skip, limit)
 * @returns {Promise<Array>}
 */
async function findRecords(filter, options = {}) {
    let query = Record.find(filter);
    
    if (options.sort) {
        query = query.sort(options.sort);
    }
    if (options.skip) {
        query = query.skip(options.skip);
    }
    if (options.limit) {
        query = query.limit(options.limit);
    }
    if (options.populate) {
        query = query.populate(options.populate);
    }
    
    return query.exec();
}

/**
 * Create a new record
 * @param {Object} data - Record data
 * @returns {Promise<Object>}
 */
async function createRecord(data) {
    return Record.create(data);
}

/**
 * Update a record by ID
 * @param {string} id - Record ID
 * @param {Object} updates - Update data
 * @returns {Promise<Object>}
 */
async function updateRecordById(id, updates) {
    return Record.findByIdAndUpdate(id, updates, { new: true, runValidators: true }).exec();
}

/**
 * Delete a record by ID
 * @param {string} id - Record ID
 * @returns {Promise<Object>}
 */
async function deleteRecordById(id) {
    const record = await Record.findById(id);
    if (record) {
        await record.deleteOne();
    }
    return record;
}

/**
 * Count records matching filter
 * @param {Object} filter - MongoDB filter object
 * @returns {Promise<number>}
 */
async function countRecords(filter) {
    return Record.countDocuments(filter);
}

/**
 * Find records shared with a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
async function findRecordsSharedWith(userId) {
    return Record.find({ sharedWith: userId }).sort({ createdAt: -1 }).exec();
}

/**
 * Find records shared by a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
async function findRecordsSharedBy(userId) {
    return Record.find({ sharedBy: userId }).sort({ createdAt: -1 }).exec();
}

module.exports = {
    findRecordById,
    findRecords,
    createRecord,
    updateRecordById,
    deleteRecordById,
    countRecords,
    findRecordsSharedWith,
    findRecordsSharedBy
};

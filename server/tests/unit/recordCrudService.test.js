/**
 * Tests for Record CRUD Service
 */

const mongoose = require('mongoose');
const {
    findRecordById,
    findRecords,
    createRecord,
    updateRecordById,
    deleteRecordById,
    countRecords,
    findRecordsSharedWith,
    findRecordsSharedBy,
} = require('../../src/services/record/crud/recordCrudService');
const Record = require('../../src/models/Record');

describe('Record CRUD Service', () => {
    describe('findRecordById', () => {
        it('should find record by id', async () => {
            const record = await Record.create({
                type: 'sale',
                recordType: 'receipt',
                user: 'user_123',
                description: 'Test receipt',
                amount: 1000,
            });

            const found = await findRecordById(record._id);

            expect(found).toBeDefined();
            expect(found._id.toString()).toBe(record._id.toString());
            expect(found.description).toBe('Test receipt');
        });

        it('should return null if record not found', async () => {
            const found = await findRecordById(new mongoose.Types.ObjectId());

            expect(found).toBeNull();
        });

        it('should populate specified fields', async () => {
            const record = await Record.create({
                type: 'sale',
                user: 'user_123',
                description: 'Test Business',
            });

            const found = await findRecordById(record._id, { populate: 'user' });

            expect(found).toBeDefined();
            expect(found._id.toString()).toBe(record._id.toString());
        });
    });

    describe('findRecords', () => {
        beforeEach(async () => {
            await Record.create([
                {
                    type: 'sale',
                    user: 'user_123',
                    description: 'Business A',
                },
                {
                    type: 'expense',
                    user: 'user_123',
                    description: 'Business B',
                },
                {
                    type: 'sale',
                    user: 'user_456',
                    description: 'Business C',
                },
            ]);
        });

        it('should find records with filter', async () => {
            const records = await findRecords({ user: 'user_123' });

            expect(records).toHaveLength(2);
            expect(records[0].user).toBe('user_123');
            expect(records[1].user).toBe('user_123');
        });

        it('should find records by type', async () => {
            const records = await findRecords({ type: 'sale' });

            expect(records).toHaveLength(2);
            expect(records[0].type).toBe('sale');
        });

        it('should sort records', async () => {
            const records = await findRecords({}, { sort: { type: 1 } });

            expect(records).toHaveLength(3);
            expect(records[0].type).toBe('expense');
        });

        it('should skip records for pagination', async () => {
            const records = await findRecords({}, { skip: 1 });

            expect(records).toHaveLength(2);
        });

        it('should limit results', async () => {
            const records = await findRecords({}, { limit: 2 });

            expect(records).toHaveLength(2);
        });

        it('should populate specified fields', async () => {
            const records = await findRecords({}, { populate: 'user' });

            expect(records).toBeDefined();
            expect(records.length).toBeGreaterThan(0);
        });

        it('should return empty array if no matches', async () => {
            const records = await findRecords({ user: 'user_nonexistent' });

            expect(records).toHaveLength(0);
        });
    });

    describe('createRecord', () => {
        it('should create new record', async () => {
            const recordData = {
                type: 'expense',
                user: 'user_789',
                description: 'New Business expense',
                amount: 5000,
            };

            const record = await createRecord(recordData);

            expect(record).toBeDefined();
            expect(record._id).toBeDefined();
            expect(record.description).toBe('New Business expense');
        });

        it('should save record to database', async () => {
            const recordData = {
                type: 'sale',
                user: 'user_999',
                description: 'Saved Business',
            };

            const created = await createRecord(recordData);
            const found = await Record.findById(created._id);

            expect(found).toBeDefined();
            expect(found.user).toBe('user_999');
        });
    });

    describe('updateRecordById', () => {
        it('should update record', async () => {
            const record = await Record.create({
                type: 'sale',
                user: 'user_123',
                description: 'Original Name',
            });

            const updated = await updateRecordById(record._id, {
                description: 'Updated Name',
            });

            expect(updated).toBeDefined();
            expect(updated.description).toBe('Updated Name');
        });

        it('should return null if record not found', async () => {
            const updated = await updateRecordById(new mongoose.Types.ObjectId(), {
                description: 'Test',
            });

            expect(updated).toBeNull();
        });

        it('should update multiple fields', async () => {
            const record = await Record.create({
                type: 'sale',
                user: 'user_123',
                description: 'Original',
            });

            const updated = await updateRecordById(record._id, {
                type: 'expense',
                description: 'Updated description',
            });

            expect(updated.type).toBe('expense');
            expect(updated.description).toBe('Updated description');
        });
    });

    describe('deleteRecordById', () => {
        it('should delete record', async () => {
            const record = await Record.create({
                type: 'sale',
                user: 'user_123',
                description: 'To Delete',
            });

            const deleted = await deleteRecordById(record._id);

            expect(deleted).toBeDefined();
            expect(deleted._id.toString()).toBe(record._id.toString());

            const found = await Record.findById(record._id);
            expect(found).toBeNull();
        });

        it('should return null if record not found', async () => {
            const deleted = await deleteRecordById(new mongoose.Types.ObjectId());

            expect(deleted).toBeNull();
        });
    });

    describe('countRecords', () => {
        beforeEach(async () => {
            await Record.create([
                { type: 'sale', user: 'user_123', description: 'Record A' },
                { type: 'expense', user: 'user_123', description: 'Record B' },
                { type: 'sale', user: 'user_456', description: 'Record C' },
            ]);
        });

        it('should count all records without filter', async () => {
            const count = await countRecords({});

            expect(count).toBe(3);
        });

        it('should count records with filter', async () => {
            const count = await countRecords({ user: 'user_123' });

            expect(count).toBe(2);
        });

        it('should count by type', async () => {
            const count = await countRecords({ type: 'sale' });

            expect(count).toBe(2);
        });

        it('should return 0 if no matches', async () => {
            const count = await countRecords({ user: 'user_nonexistent' });

            expect(count).toBe(0);
        });
    });

    describe('findRecordsSharedWith', () => {
        beforeEach(async () => {
            await Record.create([
                {
                    type: 'sale',
                    user: 'user_owner',
                    description: 'Shared A',
                    sharedWith: ['user_123', 'user_456'],
                },
                {
                    type: 'expense',
                    user: 'user_owner',
                    description: 'Shared B',
                    sharedWith: ['user_123'],
                },
                {
                    type: 'sale',
                    user: 'user_owner',
                    description: 'Not Shared',
                    sharedWith: [],
                },
            ]);
        });

        it('should find records shared with user', async () => {
            const records = await findRecordsSharedWith('user_123');

            expect(records).toHaveLength(2);
            expect(records[0].sharedWith).toContain('user_123');
            expect(records[1].sharedWith).toContain('user_123');
        });

        it('should find specific user records', async () => {
            const records = await findRecordsSharedWith('user_456');

            expect(records).toHaveLength(1);
            expect(records[0].sharedWith).toContain('user_456');
        });

        it('should return empty array if no shared records', async () => {
            const records = await findRecordsSharedWith('user_nonexistent');

            expect(records).toHaveLength(0);
        });

        it('should sort by createdAt descending', async () => {
            const records = await findRecordsSharedWith('user_123');

            expect(records).toHaveLength(2);
            // Most recent first
            if (records.length > 1) {
                expect(records[0].createdAt.getTime()).toBeGreaterThanOrEqual(
                    records[1].createdAt.getTime()
                );
            }
        });
    });

    describe('findRecordsSharedBy', () => {
        beforeEach(async () => {
            await Record.create([
                {
                    type: 'sale',
                    user: 'user_123',
                    description: 'Shared A',
                    sharedBy: 'user_123',
                    sharedWith: ['user_456'],
                },
                {
                    type: 'expense',
                    user: 'user_456',
                    description: 'Shared B',
                    sharedBy: 'user_123',
                    sharedWith: ['user_789'],
                },
                {
                    type: 'sale',
                    user: 'user_789',
                    description: 'Not Shared',
                },
            ]);
        });

        it('should find records shared by user', async () => {
            const records = await findRecordsSharedBy('user_123');

            expect(records).toHaveLength(2);
            expect(records[0].sharedBy).toBe('user_123');
            expect(records[1].sharedBy).toBe('user_123');
        });

        it('should return empty array if user has not shared records', async () => {
            const records = await findRecordsSharedBy('user_456');

            expect(records).toHaveLength(0);
        });

        it('should return empty array for nonexistent user', async () => {
            const records = await findRecordsSharedBy('user_nonexistent');

            expect(records).toHaveLength(0);
        });

        it('should sort by createdAt descending', async () => {
            const records = await findRecordsSharedBy('user_123');

            expect(records).toHaveLength(2);
            // Most recent first
            if (records.length > 1) {
                expect(records[0].createdAt.getTime()).toBeGreaterThanOrEqual(
                    records[1].createdAt.getTime()
                );
            }
        });
    });
});

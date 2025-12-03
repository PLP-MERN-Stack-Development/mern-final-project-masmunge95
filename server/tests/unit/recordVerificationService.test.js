const mongoose = require('mongoose');
const {
    validateVerificationStatus,
    validateResolutionStatus,
    isAuthorizedToVerify,
    isAuthorizedToViewVerifications,
    isAuthorizedToResolveDisputes,
    addOrUpdateVerification,
    findVerificationById,
    resolveDispute,
    applySuggestedCorrections,
} = require('../../src/services/record/verification/recordVerificationService');

describe('Record Verification Service', () => {
    describe('validateVerificationStatus', () => {
        it('should accept "verified" status', () => {
            expect(() => validateVerificationStatus('verified')).not.toThrow();
        });

        it('should accept "disputed" status', () => {
            expect(() => validateVerificationStatus('disputed')).not.toThrow();
        });

        it('should throw error for invalid status', () => {
            expect(() => validateVerificationStatus('invalid'))
                .toThrow('Invalid verification status');
        });

        it('should throw error for empty status', () => {
            expect(() => validateVerificationStatus(''))
                .toThrow('Invalid verification status');
        });

        it('should throw error for null status', () => {
            expect(() => validateVerificationStatus(null))
                .toThrow('Invalid verification status');
        });
    });

    describe('validateResolutionStatus', () => {
        it('should accept "accepted" resolution', () => {
            expect(() => validateResolutionStatus('accepted')).not.toThrow();
        });

        it('should accept "rejected" resolution', () => {
            expect(() => validateResolutionStatus('rejected')).not.toThrow();
        });

        it('should accept "modified" resolution', () => {
            expect(() => validateResolutionStatus('modified')).not.toThrow();
        });

        it('should throw error for invalid resolution', () => {
            expect(() => validateResolutionStatus('pending'))
                .toThrow('Invalid resolution status');
        });

        it('should throw error for null resolution', () => {
            expect(() => validateResolutionStatus(null))
                .toThrow('Invalid resolution status');
        });
    });

    describe('isAuthorizedToVerify', () => {
        it('should return true if user is in sharedWith array', () => {
            const record = {
                sharedWith: ['user_1', 'user_2', 'user_3'],
            };

            expect(isAuthorizedToVerify(record, 'user_2')).toBe(true);
        });

        it('should return false if user is not in sharedWith array', () => {
            const record = {
                sharedWith: ['user_1', 'user_2'],
            };

            expect(isAuthorizedToVerify(record, 'user_3')).toBe(false);
        });

        it('should return false if sharedWith is empty', () => {
            const record = {
                sharedWith: [],
            };

            expect(isAuthorizedToVerify(record, 'user_1')).toBe(false);
        });

        it('should return false if sharedWith is undefined', () => {
            const record = {};

            expect(isAuthorizedToVerify(record, 'user_1')).toBe(false);
        });
    });

    describe('isAuthorizedToViewVerifications', () => {
        it('should return true if user is record owner', () => {
            const record = {
                user: 'user_owner',
                sharedWith: [],
            };

            expect(isAuthorizedToViewVerifications(record, 'user_owner')).toBe(true);
        });

        it('should return true if user is in sharedWith', () => {
            const record = {
                user: 'user_owner',
                sharedWith: ['user_viewer'],
            };

            expect(isAuthorizedToViewVerifications(record, 'user_viewer')).toBe(true);
        });

        it('should return false if user is neither owner nor shared', () => {
            const record = {
                user: 'user_owner',
                sharedWith: ['user_viewer'],
            };

            expect(isAuthorizedToViewVerifications(record, 'user_stranger')).toBe(false);
        });
    });

    describe('isAuthorizedToResolveDisputes', () => {
        it('should return true if user is record owner', () => {
            const record = {
                user: 'user_owner',
            };

            expect(isAuthorizedToResolveDisputes(record, 'user_owner')).toBe(true);
        });

        it('should return false if user is not record owner', () => {
            const record = {
                user: 'user_owner',
            };

            expect(isAuthorizedToResolveDisputes(record, 'user_other')).toBe(false);
        });
    });

    describe('addOrUpdateVerification', () => {
        it('should add new verification if none exists', () => {
            const record = {
                verifications: [],
            };
            const userId = 'user_verifier';
            const verificationData = {
                status: 'verified',
                notes: 'All good',
            };

            addOrUpdateVerification(record, userId, verificationData);

            expect(record.verifications).toHaveLength(1);
            expect(record.verifications[0].verifiedBy).toBe('user_verifier');
            expect(record.verifications[0].status).toBe('verified');
            expect(record.verifications[0].comments).toBe('All good');
            expect(record.verifications[0].verifiedAt).toBeInstanceOf(Date);
        });

        it('should update existing verification from same user', () => {
            const existingDate = new Date('2025-01-01');
            const record = {
                verifications: [
                    {
                        verifiedBy: 'user_verifier',
                        status: 'verified',
                        notes: 'Initial verification',
                        verifiedAt: existingDate,
                    },
                ],
            };

            const verificationData = {
                status: 'disputed',
                notes: 'Found issues',
                suggestedCorrections: { total: 500 },
            };

            addOrUpdateVerification(record, 'user_verifier', verificationData);

            expect(record.verifications).toHaveLength(1);
            expect(record.verifications[0].status).toBe('disputed');
            expect(record.verifications[0].comments).toBe('Found issues');
            expect(record.verifications[0].suggestedCorrections).toEqual({ total: 500 });
            expect(record.verifications[0].verifiedAt.getTime()).toBeGreaterThan(existingDate.getTime());
        });

        it('should add separate verification if from different user', () => {
            const record = {
                verifications: [
                    {
                        verifiedBy: 'user_1',
                        status: 'verified',
                        verifiedAt: new Date(),
                    },
                ],
            };

            const verificationData = {
                status: 'disputed',
                notes: 'Disagree',
            };

            addOrUpdateVerification(record, 'user_2', verificationData);

            expect(record.verifications).toHaveLength(2);
            expect(record.verifications[1].verifiedBy).toBe('user_2');
        });
    });

    describe('findVerificationById', () => {
        it('should find verification by id', () => {
            const verificationId = new mongoose.Types.ObjectId();
            const record = {
                verifications: [
                    { _id: new mongoose.Types.ObjectId(), status: 'verified' },
                    { _id: verificationId, status: 'disputed' },
                    { _id: new mongoose.Types.ObjectId(), status: 'verified' },
                ],
            };

            const found = findVerificationById(record, verificationId.toString());

            expect(found).toBeDefined();
            expect(found.status).toBe('disputed');
        });

        it('should return undefined if verification not found', () => {
            const record = {
                verifications: [
                    { _id: new mongoose.Types.ObjectId(), status: 'verified' },
                ],
            };

            const found = findVerificationById(record, new mongoose.Types.ObjectId().toString());

            expect(found).toBeUndefined();
        });

        it('should return undefined if verifications array is empty', () => {
            const record = {
                verifications: [],
            };

            const found = findVerificationById(record, new mongoose.Types.ObjectId().toString());

            expect(found).toBeUndefined();
        });
    });

    describe('resolveDispute', () => {
        it('should update verification with resolution details', () => {
            const verification = {
                status: 'disputed',
                notes: 'Original dispute',
            };

            const resolutionData = {
                resolution: 'accepted',
                resolutionNotes: 'Corrections applied',
            };

            resolveDispute(verification, resolutionData, 'user_resolver');

            expect(verification.resolution).toBe('accepted');
            expect(verification.resolutionNotes).toBe('Corrections applied');
            expect(verification.resolvedBy).toBe('user_resolver');
            expect(verification.resolvedAt).toBeInstanceOf(Date);
        });

        it('should handle rejection resolution', () => {
            const verification = {
                status: 'disputed',
            };

            const resolutionData = {
                resolution: 'rejected',
                resolutionNotes: 'Dispute unfounded',
            };

            resolveDispute(verification, resolutionData, 'user_resolver');

            expect(verification.resolution).toBe('rejected');
            expect(verification.resolutionNotes).toBe('Dispute unfounded');
        });

        it('should handle modified resolution', () => {
            const verification = {
                status: 'disputed',
            };

            const resolutionData = {
                resolution: 'modified',
                resolutionNotes: 'Partially accepted',
            };

            resolveDispute(verification, resolutionData, 'user_resolver');

            expect(verification.resolution).toBe('modified');
        });
    });

    describe('applySuggestedCorrections', () => {
        it('should apply corrections to record.extracted', () => {
            const record = {
                extracted: {
                    total: 1000,
                    tax: 100,
                    vendor: 'Old Vendor',
                },
                markModified: jest.fn(),
            };

            const suggestedCorrections = {
                total: 1200,
                vendor: 'New Vendor',
            };

            applySuggestedCorrections(record, suggestedCorrections);

            expect(record.extracted.total).toBe(1200);
            expect(record.extracted.vendor).toBe('New Vendor');
            expect(record.extracted.tax).toBe(100); // Unchanged
            expect(record.markModified).toHaveBeenCalledWith('extracted');
        });

        it('should create extracted object if it does not exist', () => {
            const record = {
                markModified: jest.fn(),
            };

            const suggestedCorrections = {
                total: 500,
                notes: 'Corrected amount',
            };

            applySuggestedCorrections(record, suggestedCorrections);

            expect(record.extracted).toEqual({
                total: 500,
                notes: 'Corrected amount',
            });
            expect(record.markModified).toHaveBeenCalledWith('extracted');
        });

        it('should handle empty corrections', () => {
            const record = {
                extracted: {
                    total: 1000,
                },
                markModified: jest.fn(),
            };

            applySuggestedCorrections(record, {});

            expect(record.extracted.total).toBe(1000);
            expect(record.markModified).toHaveBeenCalledWith('extracted');
        });

        it('should merge multiple correction fields', () => {
            const record = {
                extracted: {
                    vendor: 'ABC Corp',
                    total: 100,
                },
                markModified: jest.fn(),
            };

            const suggestedCorrections = {
                vendor: 'XYZ Corp',
                tax: 10,
                subtotal: 90,
            };

            applySuggestedCorrections(record, suggestedCorrections);

            expect(record.extracted).toEqual({
                vendor: 'XYZ Corp',
                total: 100,
                tax: 10,
                subtotal: 90,
            });
        });
    });
});

/**
 * Tests for SellerWallet Model Methods
 */

const mongoose = require('mongoose');
const SellerWallet = require('../../src/models/SellerWallet');

describe('SellerWallet Model', () => {
    describe('canWithdraw', () => {
        it('should allow withdrawal when all conditions met', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_123',
                availableBalance: 500,
                minimumWithdrawal: 100,
                isActive: true,
                isSuspended: false,
            });

            const canWithdraw = wallet.canWithdraw(200);

            expect(canWithdraw).toBe(true);
        });

        it('should reject withdrawal if wallet is inactive', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_456',
                availableBalance: 500,
                minimumWithdrawal: 100,
                isActive: false,
            });

            const canWithdraw = wallet.canWithdraw(200);

            expect(canWithdraw).toBe(false);
        });

        it('should reject withdrawal if wallet is suspended', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_789',
                availableBalance: 500,
                minimumWithdrawal: 100,
                isActive: true,
                isSuspended: true,
            });

            const canWithdraw = wallet.canWithdraw(200);

            expect(canWithdraw).toBe(false);
        });

        it('should reject withdrawal if amount exceeds available balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_abc',
                availableBalance: 100,
                minimumWithdrawal: 50,
                isActive: true,
            });

            const canWithdraw = wallet.canWithdraw(200);

            expect(canWithdraw).toBe(false);
        });

        it('should reject withdrawal if amount below minimum', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_def',
                availableBalance: 500,
                minimumWithdrawal: 100,
                isActive: true,
            });

            const canWithdraw = wallet.canWithdraw(50);

            expect(canWithdraw).toBe(false);
        });

        it('should allow withdrawal at minimum threshold', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_ghi',
                availableBalance: 500,
                minimumWithdrawal: 100,
                isActive: true,
            });

            const canWithdraw = wallet.canWithdraw(100);

            expect(canWithdraw).toBe(true);
        });
    });

    describe('addFunds', () => {
        it('should add funds to pending balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_123',
                pendingBalance: 0,
                totalEarnings: 0,
            });

            await wallet.addFunds(500);

            expect(wallet.pendingBalance).toBe(500);
            expect(wallet.totalEarnings).toBe(500);
        });

        it('should increment stats.totalTransactions', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_456',
                stats: { totalTransactions: 0 },
            });

            await wallet.addFunds(100);

            expect(wallet.stats.totalTransactions).toBe(1);
        });

        it('should set lastPaymentDate', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_789',
            });

            await wallet.addFunds(200);

            expect(wallet.stats.lastPaymentDate).toBeDefined();
            expect(wallet.stats.lastPaymentDate).toBeInstanceOf(Date);
        });

        it('should accumulate multiple payments', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_abc',
                pendingBalance: 100,
                totalEarnings: 100,
            });

            await wallet.addFunds(300);

            expect(wallet.pendingBalance).toBe(400);
            expect(wallet.totalEarnings).toBe(400);
        });

        it('should use default type if not specified', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_def',
            });

            await wallet.addFunds(150);

            expect(wallet.pendingBalance).toBe(150);
        });

        it('should persist to database', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_ghi',
            });

            await wallet.addFunds(250);

            const found = await SellerWallet.findOne({ seller: 'user_ghi' });
            expect(found.pendingBalance).toBe(250);
        });
    });

    describe('clearPending', () => {
        it('should move funds from pending to available', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_123',
                pendingBalance: 500,
                availableBalance: 100,
            });

            await wallet.clearPending(300);

            expect(wallet.pendingBalance).toBe(200);
            expect(wallet.availableBalance).toBe(400);
        });

        it('should throw error if amount exceeds pending balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_456',
                pendingBalance: 100,
            });

            await expect(wallet.clearPending(200)).rejects.toThrow('Insufficient pending balance');
        });

        it('should allow clearing exact pending balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_789',
                pendingBalance: 150,
                availableBalance: 50,
            });

            await wallet.clearPending(150);

            expect(wallet.pendingBalance).toBe(0);
            expect(wallet.availableBalance).toBe(200);
        });

        it('should persist to database', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_abc',
                pendingBalance: 400,
                availableBalance: 100,
            });

            await wallet.clearPending(200);

            const found = await SellerWallet.findOne({ seller: 'user_abc' });
            expect(found.pendingBalance).toBe(200);
            expect(found.availableBalance).toBe(300);
        });
    });

    describe('withdraw', () => {
        it('should withdraw funds successfully', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_123',
                availableBalance: 500,
                totalWithdrawals: 0,
                minimumWithdrawal: 100,
                isActive: true,
            });

            await wallet.withdraw(200);

            expect(wallet.availableBalance).toBe(300);
            expect(wallet.totalWithdrawals).toBe(200);
        });

        it('should set lastWithdrawalDate', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_456',
                availableBalance: 500,
                minimumWithdrawal: 100,
                isActive: true,
            });

            await wallet.withdraw(150);

            expect(wallet.stats.lastWithdrawalDate).toBeDefined();
            expect(wallet.stats.lastWithdrawalDate).toBeInstanceOf(Date);
        });

        it('should throw error if canWithdraw returns false', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_789',
                availableBalance: 50,
                minimumWithdrawal: 100,
                isActive: true,
            });

            await expect(wallet.withdraw(200)).rejects.toThrow('Cannot withdraw this amount');
        });

        it('should throw error if wallet is suspended', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_abc',
                availableBalance: 500,
                minimumWithdrawal: 100,
                isActive: true,
                isSuspended: true,
            });

            await expect(wallet.withdraw(200)).rejects.toThrow('Cannot withdraw this amount');
        });

        it('should accumulate total withdrawals', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_def',
                availableBalance: 1000,
                totalWithdrawals: 300,
                minimumWithdrawal: 100,
                isActive: true,
            });

            await wallet.withdraw(200);

            expect(wallet.totalWithdrawals).toBe(500);
        });

        it('should persist to database', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_ghi',
                availableBalance: 800,
                minimumWithdrawal: 100,
                isActive: true,
            });

            await wallet.withdraw(250);

            const found = await SellerWallet.findOne({ seller: 'user_ghi' });
            expect(found.availableBalance).toBe(550);
            expect(found.totalWithdrawals).toBe(250);
        });
    });

    describe('holdFunds', () => {
        it('should hold funds from available to held balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_123',
                availableBalance: 500,
                heldBalance: 0,
            });

            await wallet.holdFunds(200, 'dispute');

            expect(wallet.availableBalance).toBe(300);
            expect(wallet.heldBalance).toBe(200);
        });

        it('should throw error if amount exceeds available balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_456',
                availableBalance: 100,
            });

            await expect(wallet.holdFunds(200, 'dispute')).rejects.toThrow('Insufficient available balance to hold');
        });

        it('should allow holding exact available balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_789',
                availableBalance: 150,
                heldBalance: 50,
            });

            await wallet.holdFunds(150, 'investigation');

            expect(wallet.availableBalance).toBe(0);
            expect(wallet.heldBalance).toBe(200);
        });

        it('should persist to database', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_abc',
                availableBalance: 600,
                heldBalance: 100,
            });

            await wallet.holdFunds(250, 'chargeback');

            const found = await SellerWallet.findOne({ seller: 'user_abc' });
            expect(found.availableBalance).toBe(350);
            expect(found.heldBalance).toBe(350);
        });
    });

    describe('releaseFunds', () => {
        it('should release funds from held to available balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_123',
                heldBalance: 300,
                availableBalance: 100,
            });

            await wallet.releaseFunds(200);

            expect(wallet.heldBalance).toBe(100);
            expect(wallet.availableBalance).toBe(300);
        });

        it('should throw error if amount exceeds held balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_456',
                heldBalance: 50,
            });

            await expect(wallet.releaseFunds(100)).rejects.toThrow('Insufficient held balance to release');
        });

        it('should allow releasing exact held balance', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_789',
                heldBalance: 150,
                availableBalance: 50,
            });

            await wallet.releaseFunds(150);

            expect(wallet.heldBalance).toBe(0);
            expect(wallet.availableBalance).toBe(200);
        });

        it('should persist to database', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_abc',
                heldBalance: 400,
                availableBalance: 200,
            });

            await wallet.releaseFunds(250);

            const found = await SellerWallet.findOne({ seller: 'user_abc' });
            expect(found.heldBalance).toBe(150);
            expect(found.availableBalance).toBe(450);
        });
    });

    describe('Integration scenarios', () => {
        it('should handle complete fund lifecycle', async () => {
            const wallet = await SellerWallet.create({
                seller: 'user_lifecycle',
                minimumWithdrawal: 100,
                isActive: true,
            });

            // Add funds (goes to pending)
            await wallet.addFunds(1000);
            expect(wallet.pendingBalance).toBe(1000);
            expect(wallet.totalEarnings).toBe(1000);

            // Clear pending to available
            await wallet.clearPending(1000);
            expect(wallet.pendingBalance).toBe(0);
            expect(wallet.availableBalance).toBe(1000);

            // Hold some funds
            await wallet.holdFunds(200, 'dispute');
            expect(wallet.availableBalance).toBe(800);
            expect(wallet.heldBalance).toBe(200);

            // Withdraw from available
            await wallet.withdraw(300);
            expect(wallet.availableBalance).toBe(500);
            expect(wallet.totalWithdrawals).toBe(300);

            // Release held funds
            await wallet.releaseFunds(200);
            expect(wallet.heldBalance).toBe(0);
            expect(wallet.availableBalance).toBe(700);
        });
    });
});

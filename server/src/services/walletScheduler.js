const cron = require('node-cron');
const SellerWallet = require('../models/SellerWallet');
const PaymentLedger = require('../models/PaymentLedger');

/**
 * Clear pending balances after clearing period (7 days)
 * Runs daily at 2:00 AM
 */
const clearPendingBalances = async () => {
    try {
        console.log('[Wallet Scheduler] Starting pending balance clearing...');
        
        const clearingPeriodDays = 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - clearingPeriodDays);
        
        // Find all ledger entries that are completed invoice_payments older than clearing period
        // and haven't been cleared yet
        const pendingEntries = await PaymentLedger.find({
            type: 'invoice_payment',
            status: 'completed',
            direction: 'credit',
            transactionDate: { $lte: cutoffDate },
            'metadata.cleared': { $ne: true },
        });
        
        console.log(`[Wallet Scheduler] Found ${pendingEntries.length} entries ready for clearing`);
        
        for (const entry of pendingEntries) {
            try {
                const wallet = await SellerWallet.findOne({ seller: entry.seller });
                
                if (!wallet) {
                    console.warn(`[Wallet Scheduler] Wallet not found for seller ${entry.seller}`);
                    continue;
                }
                
                // Calculate how much to clear (minimum of entry amount and current pending balance)
                const amountToClear = Math.min(entry.amount, wallet.pendingBalance);
                
                if (amountToClear <= 0) {
                    console.warn(`[Wallet Scheduler] No pending balance to clear for entry ${entry.transactionId}`);
                    continue;
                }
                
                // Move from pending to available
                wallet.pendingBalance -= amountToClear;
                wallet.availableBalance += amountToClear;
                await wallet.save();
                
                // Mark entry as cleared
                entry.metadata = entry.metadata || {};
                entry.metadata.cleared = true;
                entry.metadata.clearedAt = new Date();
                entry.metadata.clearedAmount = amountToClear;
                await entry.save();
                
                console.log(`[Wallet Scheduler] Cleared ${amountToClear} for seller ${entry.seller} (Entry: ${entry.transactionId})`);
                
            } catch (error) {
                console.error(`[Wallet Scheduler] Error clearing entry ${entry.transactionId}:`, error);
            }
        }
        
        console.log('[Wallet Scheduler] Pending balance clearing completed');
        
    } catch (error) {
        console.error('[Wallet Scheduler] Error in clearPendingBalances:', error);
    }
};

/**
 * Start scheduled tasks for wallet management
 */
const startWalletScheduler = () => {
    // Run daily at 2:00 AM
    cron.schedule('0 2 * * *', () => {
        console.log('[Wallet Scheduler] Running daily pending balance clearing task');
        clearPendingBalances();
    });
    
    console.log('[Wallet Scheduler] Scheduled tasks started');
    
    // Run once on startup (useful for testing)
    if (process.env.RUN_WALLET_SCHEDULER_ON_STARTUP === 'true') {
        console.log('[Wallet Scheduler] Running initial pending balance clearing on startup');
        setTimeout(clearPendingBalances, 5000); // Wait 5 seconds after startup
    }
};

/**
 * Manually clear pending balance for a specific seller
 * (Can be called by admin)
 */
const manualClearPending = async (sellerId, amount = null) => {
    try {
        const wallet = await SellerWallet.findOne({ seller: sellerId });
        
        if (!wallet) {
            throw new Error('Wallet not found');
        }
        
        const amountToClear = amount || wallet.pendingBalance;
        
        if (amountToClear > wallet.pendingBalance) {
            throw new Error('Cannot clear more than pending balance');
        }
        
        await wallet.clearPending(amountToClear);
        
        // Create ledger entry for manual clearing
        const ledgerEntry = new PaymentLedger({
            transactionId: `MANUAL-CLEAR-${Date.now()}`,
            type: 'platform_fee', // Use platform_fee type for internal adjustments
            seller: sellerId,
            amount: amountToClear,
            currency: wallet.currency,
            direction: 'credit',
            balanceAfter: wallet.availableBalance + wallet.pendingBalance + wallet.heldBalance,
            status: 'completed',
            platformFee: 0,
            processingFee: 0,
            netAmount: amountToClear,
            metadata: {
                manualClearing: true,
                clearedAt: new Date(),
                note: 'Manual pending balance clearing by admin',
            },
        });
        
        await ledgerEntry.save();
        
        return {
            success: true,
            amountCleared: amountToClear,
            newAvailableBalance: wallet.availableBalance,
            newPendingBalance: wallet.pendingBalance,
        };
        
    } catch (error) {
        console.error('[Wallet Scheduler] Manual clear error:', error);
        throw error;
    }
};

module.exports = {
    startWalletScheduler,
    clearPendingBalances,
    manualClearPending,
};

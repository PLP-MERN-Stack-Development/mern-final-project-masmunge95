const mongoose = require('mongoose');
const { processPendingWithdrawals } = require('../services/autoWithdrawalService');

/**
 * Cron job to process pending withdrawal requests automatically
 * Run this every 15 minutes or hourly
 */
async function processWithdrawalsJob() {
  console.log('[WithdrawalJob] Starting automatic withdrawal processing...');
  
  try {
    const results = await processPendingWithdrawals();
    
    console.log('[WithdrawalJob] Processing complete:', results);
    
    return results;
  } catch (error) {
    console.error('[WithdrawalJob] Error processing withdrawals:', error);
    throw error;
  }
}

// If run directly from command line
if (require.main === module) {
  require('dotenv').config();
  
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log('MongoDB connected for withdrawal processing job');
    
    await processWithdrawalsJob();
    
    console.log('Job complete. Disconnecting...');
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(error => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });
}

module.exports = processWithdrawalsJob;

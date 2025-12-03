/**
 * Fee Service - Centralized fee calculation and configuration
 * 
 * Fee Philosophy:
 * ✅ Platform absorbs fees for: Subscriptions only
 * ❌ Platform does NOT absorb fees for: Customer payments, invoices, withdrawals, bulk operations
 * 
 * This protects profit margins while making subscription signup frictionless.
 */

/**
 * Get M-Pesa transaction fee based on amount (Safaricom standard rates)
 * These are the actual fees charged by Safaricom
 */
function getMpesaTransactionFee(amount) {
  // Safaricom M-Pesa B2C/Paybill fees (approximate)
  if (amount <= 100) return 0;
  if (amount <= 500) return 5;
  if (amount <= 1000) return 10;
  if (amount <= 1500) return 15;
  if (amount <= 2500) return 20;
  if (amount <= 3500) return 25;
  if (amount <= 5000) return 30;
  if (amount <= 7500) return 35;
  if (amount <= 10000) return 40;
  if (amount <= 15000) return 45;
  if (amount <= 20000) return 50;
  if (amount <= 35000) return 55;
  if (amount <= 50000) return 60;
  if (amount <= 70000) return 65;
  return 70; // Max fee
}

/**
 * Get bank transfer processing fee
 */
function getBankTransferFee(amount) {
  // Typical bank transfer fees in Kenya
  if (amount <= 5000) return 50;
  if (amount <= 10000) return 75;
  if (amount <= 50000) return 100;
  return 150;
}

/**
 * Get IntaSend processing fee (their standard rates)
 * IntaSend charges: 3.5% + KES 10 for M-Pesa
 */
function getIntasendFee(amount, method = 'mpesa') {
  if (method === 'mpesa') {
    return (amount * 0.035) + 10; // 3.5% + KES 10
  } else if (method === 'card') {
    return (amount * 0.04) + 15; // 4% + KES 15
  }
  return 0;
}

/**
 * Calculate fees for different transaction types
 */
const FeeCalculator = {
  /**
   * SUBSCRIPTION PAYMENTS
   * Platform absorbs ALL fees to improve signup/retention
   */
  subscription: (amount, method = 'mpesa') => {
    const intasendFee = getIntasendFee(amount, method);
    const mpesaFee = method === 'mpesa' ? getMpesaTransactionFee(amount) : 0;
    
    return {
      platformFee: 0, // We don't charge platform fee on subscriptions
      processingFee: 0, // We absorb ALL processing fees for subscriptions
      totalFees: 0,
      netToSeller: amount, // Seller/platform gets full amount
      feesAbsorbedByPlatform: intasendFee + mpesaFee, // What it costs us
      paidByCustomer: amount, // Customer pays exact subscription price
      
      breakdown: {
        intasendFee,
        mpesaFee,
        note: 'Platform absorbs all subscription fees to improve signup experience'
      }
    };
  },

  /**
   * INVOICE/CUSTOMER PAYMENTS
   * Customer pays the fees (standard SaaS approach)
   */
  invoicePayment: (amount, method = 'mpesa') => {
    const intasendFee = getIntasendFee(amount, method);
    const mpesaFee = method === 'mpesa' ? getMpesaTransactionFee(amount) : 0;
    const totalProcessingFee = intasendFee + mpesaFee;
    
    return {
      platformFee: 0, // No platform commission on invoice payments (seller keeps 100%)
      processingFee: totalProcessingFee, // Customer pays processing fees
      totalFees: totalProcessingFee,
      netToSeller: amount, // Seller gets full invoice amount
      feesAbsorbedByPlatform: 0,
      paidByCustomer: amount + totalProcessingFee, // Customer pays invoice + fees
      
      breakdown: {
        intasendFee,
        mpesaFee,
        note: 'Customer pays transaction fees (standard for SaaS payment processing)'
      }
    };
  },

  /**
   * SELLER WITHDRAWALS
   * Seller pays withdrawal fees (deducted from withdrawal amount)
   */
  withdrawal: (amount, method = 'mpesa') => {
    // Platform fee: 2% of withdrawal
    const platformFee = amount * 0.02;
    
    // Processing fees
    let processingFee = 0;
    if (method === 'mpesa') {
      processingFee = getMpesaTransactionFee(amount) + 10; // M-Pesa fee + IntaSend B2C fee
    } else if (method === 'bank') {
      processingFee = getBankTransferFee(amount);
    }
    
    const totalFees = platformFee + processingFee;
    const netAmount = amount - totalFees;
    
    return {
      platformFee,
      processingFee,
      totalFees,
      netToSeller: netAmount, // What seller actually receives
      feesAbsorbedByPlatform: 0,
      paidByCustomer: 0,
      
      breakdown: {
        platformCommission: platformFee,
        transactionCost: processingFee,
        note: 'Seller pays 2% platform fee + transaction costs on withdrawals'
      }
    };
  },

  /**
   * BULK OPERATIONS (e.g., bulk SMS, bulk email)
   * Customer pays per-operation fees
   */
  bulkOperation: (operationCount, costPerOperation = 1) => {
    const totalCost = operationCount * costPerOperation;
    
    return {
      platformFee: 0,
      processingFee: totalCost,
      totalFees: totalCost,
      netToSeller: 0,
      feesAbsorbedByPlatform: 0,
      paidByCustomer: totalCost,
      
      breakdown: {
        operations: operationCount,
        costPerOperation,
        totalCost,
        note: 'Customer pays for bulk operations at cost'
      }
    };
  },

  /**
   * OCR/DOCUMENT SCANNING
   * Customer pays per-scan fees (Azure/processing costs)
   */
  ocrScan: (scanCount) => {
    const costPerScan = 5; // KES 5 per scan (covers Azure API costs)
    const totalCost = scanCount * costPerScan;
    
    return {
      platformFee: 0,
      processingFee: totalCost,
      totalFees: totalCost,
      netToSeller: 0,
      feesAbsorbedByPlatform: 0,
      paidByCustomer: totalCost,
      
      breakdown: {
        scans: scanCount,
        costPerScan,
        totalCost,
        note: 'Customer pays KES 5 per document scan'
      }
    };
  }
};

/**
 * Get user-friendly fee description for display
 */
function getFeeDescription(transactionType) {
  const descriptions = {
    subscription: 'No fees! We cover all transaction costs for subscriptions.',
    invoicePayment: 'Transaction fees apply and are paid by the customer paying the invoice.',
    withdrawal: 'Withdrawal fees: 2% platform fee + transaction costs (deducted from amount).',
    bulkOperation: 'Pay-as-you-go pricing. Fees charged per operation.',
    ocrScan: 'KES 5 per document scanned.',
  };
  
  return descriptions[transactionType] || 'Standard transaction fees apply.';
}

/**
 * Calculate and display fees for customer (what they'll pay)
 */
function displayCustomerFees(amount, transactionType, method = 'mpesa') {
  const fees = FeeCalculator[transactionType](amount, method);
  
  return {
    baseAmount: amount,
    fees: fees.processingFee,
    total: fees.paidByCustomer || amount,
    description: getFeeDescription(transactionType),
    breakdown: fees.breakdown,
  };
}

/**
 * Configuration: Who pays fees for each transaction type
 */
const FeeConfig = {
  subscription: {
    paidBy: 'platform',
    absorb: true,
    reason: 'Improve signup and retention',
  },
  invoicePayment: {
    paidBy: 'customer',
    absorb: false,
    reason: 'Standard SaaS practice - customer pays for payment processing',
  },
  withdrawal: {
    paidBy: 'seller',
    absorb: false,
    reason: 'Seller pays for accessing their funds',
  },
  bulkOperation: {
    paidBy: 'customer',
    absorb: false,
    reason: 'Pay-as-you-go for extra services',
  },
  ocrScan: {
    paidBy: 'customer',
    absorb: false,
    reason: 'Covers Azure API costs',
  },
};

/**
 * Get pricing display for frontend
 */
function getPricingDisplay() {
  return {
    subscriptions: {
      starter: {
        price: 500,
        fees: 0,
        total: 500,
        note: 'No transaction fees - we cover them!',
      },
      professional: {
        price: 1500,
        fees: 0,
        total: 1500,
        note: 'No transaction fees - we cover them!',
      },
      enterprise: {
        price: 5000,
        fees: 0,
        total: 5000,
        note: 'No transaction fees - we cover them!',
      },
    },
    
    invoicePayments: {
      note: 'Transaction fees are paid by the customer making the payment',
      example: {
        invoiceAmount: 10000,
        fees: FeeCalculator.invoicePayment(10000).processingFee,
        customerPays: FeeCalculator.invoicePayment(10000).paidByCustomer,
        sellerReceives: 10000,
      },
    },
    
    withdrawals: {
      note: 'Withdrawal fees are deducted from your withdrawal amount',
      fees: '2% platform fee + transaction costs',
      example: {
        withdrawAmount: 5000,
        fees: FeeCalculator.withdrawal(5000).totalFees,
        youReceive: FeeCalculator.withdrawal(5000).netToSeller,
      },
    },
  };
}

module.exports = {
  FeeCalculator,
  FeeConfig,
  getMpesaTransactionFee,
  getBankTransferFee,
  getIntasendFee,
  getFeeDescription,
  displayCustomerFees,
  getPricingDisplay,
};

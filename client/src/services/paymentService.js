import api from './api';

/**
 * Initiates a payment for a given invoice.
 * @param {string} invoiceId The ID of the invoice to pay.
 * @returns {Promise<{paymentLink: string}>} The payment link from the provider.
 */
export const makePayment = async (invoiceId, paymentDetails) => {
  try {
    const response = await api.post('/payments/pay', { 
      _id: invoiceId,  // Backend expects _id
      invoiceId,       // Also send invoiceId for compatibility
      ...paymentDetails 
    });
    return response.data;
  } catch (error) {
    console.error('Error making payment:', error);
    throw error;
  }
};
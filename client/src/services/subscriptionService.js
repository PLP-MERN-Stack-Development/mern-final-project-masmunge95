import api from './api';

/**
 * Get current user's subscription details
 */
export const getCurrentSubscription = async () => {
  try {
    const response = await api.get('/subscriptions/current');
    return response.data;
  } catch (error) {
    console.error('Error fetching subscription:', error);
    throw error;
  }
};

/**
 * Get all available subscription plans
 */
export const getSubscriptionPlans = async () => {
  try {
    const response = await api.get('/subscriptions/plans');
    return response.data;
  } catch (error) {
    console.error('Error fetching plans:', error);
    throw error;
  }
};

/**
 * Upgrade to a paid subscription tier
 */
export const upgradeSubscription = async (tier, paymentMethod = 'MPESA', phoneNumber, billingCycle = 'monthly') => {
  try {
    const response = await api.post('/subscriptions/upgrade', {
      tier,
      paymentMethod,
      phoneNumber,
      billingCycle,
    });
    return response.data;
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    throw error;
  }
};

/**
 * Cancel subscription at end of billing period
 */
export const cancelSubscription = async () => {
  try {
    const response = await api.post('/subscriptions/cancel');
    return response.data;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }
};

/**
 * Reactivate a canceled subscription
 */
export const reactivateSubscription = async () => {
  try {
    const response = await api.post('/subscriptions/reactivate');
    return response.data;
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    throw error;
  }
};

/**
 * Get current usage statistics
 */
export const getUsageStats = async () => {
  try {
    const response = await api.get('/subscriptions/usage');
    return response.data;
  } catch (error) {
    console.error('Error fetching usage:', error);
    throw error;
  }
};

/**
 * Extend trial period by 14 days (one-time only)
 */
export const extendTrial = async () => {
  try {
    const response = await api.post('/subscriptions/extend-trial');
    return response.data;
  } catch (error) {
    console.error('Error extending trial:', error);
    throw error;
  }
};

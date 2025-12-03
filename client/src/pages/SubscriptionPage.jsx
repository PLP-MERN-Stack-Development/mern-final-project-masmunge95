import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import CenteredLoader from '../components/CenteredLoader';
import Toast from '../components/Toast';
import {
    getCurrentSubscription,
    getSubscriptionPlans,
    upgradeSubscription,
    cancelSubscription,
    reactivateSubscription,
    getUsageStats,
    extendTrial
} from '../services/subscriptionService';
import { getCache, setCache } from '../utils/localCache';

const SubscriptionPage = () => {
    const { theme } = useTheme();
    const { isLoaded } = useAuth();
    const { user } = useUser();
    const [subscription, setSubscription] = useState(null);
    const [plans, setPlans] = useState([]);
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [billingCycle, setBillingCycle] = useState('monthly');
    const [paymentMethod, setPaymentMethod] = useState('MPESA');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [toast, setToast] = useState(null);
    const navigate = useNavigate();

    const showToast = (message, type = 'info') => {
        setToast({ message, type });
    };

    useEffect(() => {
        if (!isLoaded) return;

        // Cache version to force refresh when data structure changes
        const CACHE_VERSION = 'v2';
        const cachedVersion = getCache('subscription.version');
        
        // Only use cache if version matches
        if (cachedVersion === CACHE_VERSION) {
            // Read cached values immediately for instant UI
            const cachedSub = getCache('subscription.current');
            const cachedPlans = getCache('subscription.plans');
            const cachedUsage = getCache('subscription.usage');
            if (cachedSub) setSubscription(cachedSub);
            if (cachedPlans) setPlans(cachedPlans);
            if (cachedUsage) setUsage(cachedUsage);
            // If we had any cache, show it immediately and fetch in background
            if (cachedSub || cachedPlans || cachedUsage) setLoading(false);
        }

        // Then fetch fresh data and update cache
        fetchSubscriptionData();
    }, [isLoaded]);

    const fetchSubscriptionData = async () => {
        try {
            setLoading(true);
            const [subData, plansData, usageData] = await Promise.all([
                getCurrentSubscription(),
                getSubscriptionPlans(),
                getUsageStats(),
            ]);
            console.log('Subscription data:', subData);
            console.log('Plans data:', plansData);
            console.log('Usage data:', usageData);
                setSubscription(subData.subscription);
                setPlans(plansData.plans);
                setUsage(usageData);

                // Cache results for instant subsequent loads
                try {
                    setCache('subscription.version', 'v2');
                    setCache('subscription.current', subData.subscription);
                    setCache('subscription.plans', plansData.plans);
                    setCache('subscription.usage', usageData);
                } catch (e) { /* ignore cache errors */ }
        } catch (error) {
            console.error('Error fetching subscription data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (tier, cycle = 'monthly') => {
        // Validation for M-Pesa only (Card redirects to Instasend)
        if (paymentMethod === 'MPESA' && !phoneNumber) {
            showToast('Please enter your M-Pesa phone number', 'warning');
            return;
        }

        try {
            setUpgrading(true);
            const response = await upgradeSubscription(tier, paymentMethod, phoneNumber, cycle);
            
            // For card payments, redirect to Instasend's secure payment page
            if (paymentMethod === 'CARD' && response.paymentUrl) {
                showToast('Redirecting to secure payment page...', 'info');
                // Redirect to Instasend's payment page
                window.location.href = response.paymentUrl;
                return;
            }
            
            // For M-Pesa, show success message
            showToast(`Payment initiated for ${tier} tier (${cycle} billing). Your subscription will be activated once payment is confirmed.`, 'info');
            setSelectedPlan(null);
            setBillingCycle('monthly');
            setPhoneNumber('');
            fetchSubscriptionData();
        } catch (error) {
            console.error('Error upgrading:', error);
            showToast(error.response?.data?.message || 'Failed to initiate payment. Please try again.', 'error');
        } finally {
            setUpgrading(false);
        }
    };

    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    const handleCancel = async () => {
        // open confirmation modal
        setShowCancelConfirm(true);
    };

    const performCancel = async () => {
        setShowCancelConfirm(false);
        try {
            await cancelSubscription();
            showToast('Subscription canceled. You will retain access until the end of your billing period.', 'success');
            fetchSubscriptionData();
        } catch (error) {
            console.error('Error canceling:', error);
            showToast('Failed to cancel subscription', 'error');
        }
    };

    const handleReactivate = async () => {
        try {
            await reactivateSubscription();
            showToast('Subscription reactivated successfully!', 'success');
            fetchSubscriptionData();
        } catch (error) {
            console.error('Error reactivating:', error);
            showToast('Failed to reactivate subscription', 'error');
        }
    };

    const handleExtendTrial = async () => {
        try {
            const response = await extendTrial();
            showToast(response.message || 'Trial extended by 14 days!', 'success');
            fetchSubscriptionData();
        } catch (error) {
            console.error('Error extending trial:', error);
            const errorMsg = error.response?.data?.error || 'Failed to extend trial';
            showToast(errorMsg, 'error');
        }
    };

    const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
    const secondaryTextColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';

    const renderUsageStat = (label, current, limit, percent) => {
        const isUnlimited = typeof limit === 'string' && limit === 'unlimited';
        const percentage = isUnlimited ? 0 : Math.min(percent, 100);
        const isNearLimit = percentage >= 80;

        return (
            <div className={`rounded-xl p-6 backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className={`text-sm font-medium ${secondaryTextColor}`}>{label}</h3>
                    <span className={`text-xs font-semibold ${isNearLimit ? 'text-red-500' : secondaryTextColor}`}>
                        {current} / {isUnlimited ? '∞' : limit}
                    </span>
                </div>

                {!isUnlimited && (
                    <div className={`w-full rounded-full h-2 mb-2 ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200'}`}>
                        <div
                            className={`h-2 rounded-full transition-all ${isNearLimit ? 'bg-red-500' : 'bg-green-500'
                                }`}
                            style={{ width: `${percentage}%` }}
                        ></div>
                    </div>
                )}

                <p className={`text-xs ${secondaryTextColor}`}>
                    {isUnlimited ? 'Unlimited usage' : `${percentage.toFixed(0)}% used`}
                </p>
            </div>
        );
    };

    if (loading) {
        return <CenteredLoader message="Loading subscription..." />;
    }

    const backTarget = user?.publicMetadata?.role === 'seller' ? '/seller-dashboard' : '/customer-dashboard';

    return (
        <div className="px-3 sm:px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="mb-2 md:hidden px-3 sm:px-4">
                <Link to={backTarget} className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                    Back to Dashboard
                </Link>
            </div>
            {/* Header Section */}
            <div className={`mb-8 p-8 rounded-2xl shadow-xl backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
                <div className="flex items-center gap-3 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <h1 className={`text-4xl font-bold ${textColor}`}>
                        Subscription Management
                    </h1>
                </div>
                <p className={`text-lg ${secondaryTextColor}`}>
                    Manage your subscription plan and track usage
                </p>
            </div>

            {/* Current Subscription Status */}
            {subscription && (
                <div className={`rounded-2xl shadow-xl p-8 mb-8 backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h2 className={`text-2xl font-bold ${textColor} capitalize mb-2`}>
                                Current Plan: {subscription.tier}
                            </h2>
                            <p className={secondaryTextColor}>
                                {subscription.isActive ? (
                                    <span className="inline-flex items-center text-green-500 font-semibold">
                                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Active
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center text-red-500 font-semibold">
                                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        Expired
                                    </span>
                                )}
                            </p>

                            {subscription.tier === 'trial' && subscription.daysRemaining !== null && (
                                <div className={`rounded-xl p-5 mt-4 shadow-md border-2 ${
                                    theme === 'dark' 
                                        ? 'bg-yellow-900/20 border-yellow-700' 
                                        : 'bg-amber-50 border-amber-300'
                                }`}>
                                    <p className={`font-bold text-lg flex items-center gap-2 ${
                                        theme === 'dark' ? 'text-yellow-200' : 'text-amber-900'
                                    }`}>
                                        <span className="text-2xl">⏰</span>
                                        {subscription.daysRemaining} days remaining in your free trial
                                    </p>
                                    <p className={`text-sm mt-2 font-medium ${
                                        theme === 'dark' ? 'text-yellow-300' : 'text-amber-800'
                                    }`}>
                                        Upgrade now to continue using RecordIQ after your trial ends
                                    </p>
                                    
                                    {/* Trial Extension Button - Show if eligible */}
                                    {!subscription.trialExtended && subscription.daysRemaining < 14 && (
                                        <div className="mt-4 pt-4 border-t border-amber-400/30">
                                            <p className={`text-xs mb-3 ${
                                                theme === 'dark' ? 'text-yellow-300/80' : 'text-amber-700'
                                            }`}>
                                                Need more time? Extend your trial by 14 days (one-time offer)
                                            </p>
                                            <Button
                                                onClick={handleExtendTrial}
                                                variant="secondary"
                                                size="sm"
                                                className="w-full sm:w-auto"
                                            >
                                                <svg 
                                                    className="w-4 h-4 mr-2" 
                                                    fill="none" 
                                                    stroke="currentColor" 
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path 
                                                        strokeLinecap="round" 
                                                        strokeLinejoin="round" 
                                                        strokeWidth={2} 
                                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                                                    />
                                                </svg>
                                                Extend Trial (+14 Days)
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {subscription.cancelAtPeriodEnd && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mt-4">
                                    <p className="text-red-800 dark:text-red-200 font-semibold">
                                        Subscription will be canceled on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                                    </p>
                                    <Button onClick={handleReactivate} className="mt-2">
                                        Reactivate Subscription
                                    </Button>
                                </div>
                            )}
                        </div>

                        {subscription.tier !== 'trial' && !subscription.cancelAtPeriodEnd && (
                            <button
                                onClick={handleCancel}
                                className="text-red-500 hover:text-red-600 font-semibold"
                            >
                                Cancel Subscription
                            </button>
                        )}
                    </div>
                    <ConfirmModal
                        isOpen={showCancelConfirm}
                        title="Cancel Subscription"
                        message={'Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.'}
                        confirmLabel="Cancel Subscription"
                        cancelLabel="Keep Subscription"
                        onCancel={() => setShowCancelConfirm(false)}
                        onConfirm={() => performCancel()}
                    />
                </div>
            )}

            {/* Usage Statistics */}
            {usage && (
                <div className={`rounded-2xl shadow-xl p-8 mb-8 backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90 border border-gray-700/50' : 'bg-white/90 border border-gray-200/50'}`}>
                    <h2 className={`text-2xl font-bold ${textColor} mb-6`}>Usage This Month</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {renderUsageStat('Invoices', usage.usage.invoices, usage.limits.invoices, usage.percentUsed.invoices)}
                        {renderUsageStat('Customers', usage.usage.customers, usage.limits.customers, usage.percentUsed.customers)}
                        {renderUsageStat('Seller OCR Scans', usage.usage.ocrScans, usage.limits.ocrScans, usage.percentUsed.ocrScans)}
                        {renderUsageStat('Customer OCR Scans', usage.usage.customerOcrScans || 0, usage.limits.customerOcrScans, usage.percentUsed.customerOcrScans || 0)}
                    </div>
                </div>
            )}

            {/* Available Plans */}
            {plans.length > 0 && subscription && (
                <div className="mb-8">
                    <h2 className={`text-3xl font-bold ${textColor} mb-6`}>Subscription Plans</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {plans.map((plan) => (
                            <div
                                key={plan.tier}
                                className={`rounded-2xl shadow-xl p-8 border-2 transition-all backdrop-blur-sm ${theme === 'dark' ? 'bg-gray-800/90' : 'bg-white/90'
                                    } ${subscription.tier === plan.tier
                                        ? 'border-red-500'
                                        : theme === 'dark' ? 'border-gray-700/50 hover:border-red-700' : 'border-gray-200/50 hover:border-red-300'
                                    }`}
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${plan.tier === 'basic' ? 'bg-blue-500' :
                                        plan.tier === 'pro' ? 'bg-purple-500' :
                                            'bg-red-500'
                                    }`}>
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                </div>

                                <h3 className={`text-2xl font-bold ${textColor} capitalize mb-2`}>
                                    {plan.tier}
                                </h3>

                                <div className="mb-4">
                                    <span className={`text-4xl font-bold ${textColor}`}>
                                        ${plan.monthlyPrice}
                                    </span>
                                    <span className={secondaryTextColor}>/month</span>
                                </div>

                                <div className="mb-6">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-500 dark:text-white border border-green-300 dark:border-green-500">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        No transaction fees - we cover them!
                                    </span>
                                </div>

                                <ul className="space-y-3 mb-8">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span className={`text-sm ${secondaryTextColor}`}>{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {subscription.tier === plan.tier ? (
                                    <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 py-3 rounded-xl text-center font-semibold">
                                        Current Plan
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() => setSelectedPlan(plan)}
                                        className="w-full"
                                        disabled={upgrading}
                                    >
                                        Upgrade to {plan.tier}
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Upgrade Modal */}
            {selectedPlan && (
                <div 
                    className="fixed inset-0 bg-white/30 dark:bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => {
                        setSelectedPlan(null);
                        setBillingCycle('monthly');
                        setPaymentMethod('MPESA');
                        setPhoneNumber('');
                    }}
                >

                    <div 
                        className={`relative rounded-2xl shadow-2xl max-w-lg w-full p-8 my-8 border max-h-[90vh] overflow-y-auto ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => {
                                setSelectedPlan(null);
                                setBillingCycle('monthly');
                                setPaymentMethod('MPESA');
                                setPhoneNumber('');
                            }}
                            className={`absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700`}
                            aria-label="Close modal"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h3 className={`text-2xl font-bold mb-6 capitalize ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            Upgrade to {selectedPlan.tier} Plan
                        </h3>

                        {/* Billing Cycle Toggle */}
                        <div className="mb-6">
                            <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                Billing Cycle
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setBillingCycle('monthly')}
                                    className={`px-4 py-3 rounded-xl font-semibold transition-all ${billingCycle === 'monthly'
                                            ? 'bg-red-500 text-white shadow-lg'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    Monthly
                                    <div className="text-xs mt-1">${selectedPlan.monthlyPrice}/mo</div>
                                </button>
                                <button
                                    onClick={() => setBillingCycle('annual')}
                                    className={`px-4 py-3 rounded-xl font-semibold transition-all relative ${billingCycle === 'annual'
                                            ? 'bg-red-500 text-white shadow-lg'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    {selectedPlan.annualDiscount && (
                                        <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                            Save {selectedPlan.annualDiscount}
                                        </span>
                                    )}
                                    Annual
                                    <div className="text-xs mt-1">${selectedPlan.annualPrice}/yr</div>
                                </button>
                            </div>
                        </div>

                        {/* Amount Summary */}
                        <div className={`rounded-xl p-4 mb-6 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Total Amount:</span>
                                <span className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                    ${billingCycle === 'annual' ? selectedPlan.annualPrice : selectedPlan.monthlyPrice}
                                </span>
                            </div>
                            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                Billed {billingCycle}
                                {billingCycle === 'annual' && selectedPlan.annualSavings && (
                                    <span className="text-green-600 dark:text-green-400 font-semibold ml-2">
                                        (Save ${selectedPlan.annualSavings}!)
                                    </span>
                                )}
                            </p>
                            <p className={`text-xs mt-2 italic ${theme === 'dark' ? 'text-gray-500' : 'text-gray-500'}`}>
                                Amount will be converted to KSH for payment processing
                            </p>
                            <div className={`flex items-start gap-2 mt-3 p-2 rounded-lg ${theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'}`}>
                                <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <p className={`text-xs ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>
                                    We cover all transaction fees for subscriptions. You pay exactly the amount shown above.
                                </p>
                            </div>
                        </div>

                        {/* Payment Method Selection */}
                        <div className="mb-6">
                            <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                Payment Method
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setPaymentMethod('MPESA')}
                                    className={`px-4 py-3 rounded-xl font-semibold transition-all flex flex-col items-center gap-2 ${paymentMethod === 'MPESA'
                                            ? 'bg-green-500 text-white shadow-lg'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                                    </svg>
                                    M-Pesa
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('CARD')}
                                    className={`px-4 py-3 rounded-xl font-semibold transition-all flex flex-col items-center gap-2 relative ${paymentMethod === 'CARD'
                                            ? 'bg-blue-500 text-white shadow-lg'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                    </svg>
                                    Card
                                    <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded">
                                        Auto-renew
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Payment Details based on method */}
                        {paymentMethod === 'MPESA' && (
                            <div className="mb-6">
                                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    M-Pesa Phone Number
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="254712345678"
                                    className={`w-full px-4 py-3 rounded-xl border-2 transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500 focus:ring-2 focus:ring-green-500/50' : 'bg-gray-50 border-gray-300 text-black focus:border-green-500 focus:ring-2 focus:ring-green-500/50'}`}
                                />
                                <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                    You'll receive an M-Pesa prompt on your phone
                                </p>
                            </div>
                        )}

                        {paymentMethod === 'CARD' && (
                            <div className="mb-6">
                                <div className={`rounded-xl p-5 border-2 ${theme === 'dark' ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
                                    <div className="flex items-start gap-3">
                                        <svg className={`w-6 h-6 flex-shrink-0 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                        <div>
                                            <p className={`font-semibold mb-2 ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>
                                                Secure Payment Processing
                                            </p>
                                            <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>
                                                You'll be redirected to Instasend's secure payment page to enter your card details. Your information is encrypted and never stored on our servers.
                                            </p>
                                            <ul className={`mt-3 space-y-1 text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                                                <li className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                    PCI DSS compliant payment processing
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                    Automatic renewals - cancel anytime
                                                </li>
                                                <li className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                    Bank-level encryption and security
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-4">
                            <Button
                                onClick={() => handleUpgrade(selectedPlan.tier, billingCycle)}
                                disabled={upgrading}
                                className="flex-1"
                            >
                                {upgrading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Processing...
                                    </span>
                                ) : (
                                    `Pay $${billingCycle === 'annual' ? selectedPlan.annualPrice : selectedPlan.monthlyPrice}`
                                )}
                            </Button>
                            <button
                                onClick={() => {
                                    setSelectedPlan(null);
                                    setBillingCycle('monthly');
                                    setPaymentMethod('MPESA');
                                    setPhoneNumber('');
                                }}
                                className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-semibold transition-colors"
                                disabled={upgrading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default SubscriptionPage;

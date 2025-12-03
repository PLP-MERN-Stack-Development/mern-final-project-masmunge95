import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { getCurrentSubscription } from '../services/subscriptionService';

const SubscriptionBanner = () => {
  const { isLoaded } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    fetchSubscription();
  }, [isLoaded]);

  const fetchSubscription = async () => {
    try {
      const data = await getCurrentSubscription();
      setSubscription(data.subscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  if (!subscription || dismissed || !subscription.isActive) {
    return null;
  }

  // Show banner if trial is ending soon (less than 3 days)
  const shouldShowBanner = subscription.tier === 'trial' && subscription.daysRemaining <= 3;

  if (!shouldShowBanner) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 border-b border-yellow-600">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold">
                ⏰ Only {subscription.daysRemaining} day{subscription.daysRemaining !== 1 ? 's' : ''} left in your free trial!
              </p>
              <p className="text-white/90 text-sm">
                Upgrade now to continue using RecordIQ without interruption
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/subscription"
              className="bg-white text-yellow-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-100 transition-colors shadow-lg"
            >
              Upgrade Now
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="text-white hover:text-white/80 p-2"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionBanner;

import { Link } from 'react-router-dom';
import { 
  BanknotesIcon, 
  WalletIcon, 
  DocumentTextIcon, 
  ChartBarIcon,
  UsersIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../context/ThemeContext';

/**
 * Admin Dashboard - Main landing page for admin functions
 * Provides navigation to all admin management tools
 */
export default function AdminDashboardPage() {
  const { theme } = useTheme();
  
  const adminCards = [
    {
      title: 'Withdrawal Management',
      description: 'Review and approve/reject withdrawal requests, view security issues',
      icon: BanknotesIcon,
      link: '/admin/withdrawals',
      color: 'blue',
      stats: 'Pending requests'
    },
    {
      title: 'Wallet Management',
      description: 'View seller wallets, clear pending balances, monitor holdings',
      icon: WalletIcon,
      link: '/admin/wallets',
      color: 'green',
      stats: 'Active wallets'
    },
    {
      title: 'Billing & Reconciliation',
      description: 'Reconcile subscription usage, view analysis events, sync billing',
      icon: DocumentTextIcon,
      link: '/admin/billing',
      color: 'purple',
      stats: 'Events to reconcile'
    },
    {
      title: 'Payment Ledger',
      description: 'View all transactions, filter by type/status, export reports',
      icon: ChartBarIcon,
      link: '/admin/ledger',
      color: 'yellow',
      stats: 'Recent transactions'
    },
    {
      title: 'User Management',
      description: 'Manage user accounts, roles, and permissions (Coming Soon)',
      icon: UsersIcon,
      link: '#',
      color: 'indigo',
      stats: 'Coming Soon',
      disabled: true
    },
    {
      title: 'Platform Settings',
      description: 'Configure fees, limits, auto-approval rules (Coming Soon)',
      icon: CogIcon,
      link: '#',
      color: 'gray',
      stats: 'Coming Soon',
      disabled: true
    },
  ];

  const getColorClasses = (color, disabled = false) => {
    if (disabled) {
      return {
        bg: 'bg-gray-200 dark:bg-gray-700',
        icon: 'text-gray-400 dark:text-gray-500',
        hover: ''
      };
    }

    const colors = {
      blue: {
        bg: 'bg-blue-100 dark:bg-blue-500/20',
        icon: 'text-blue-600 dark:text-blue-400',
        hover: ''
      },
      green: {
        bg: 'bg-green-100 dark:bg-green-500/20',
        icon: 'text-green-600 dark:text-green-400',
        hover: ''
      },
      purple: {
        bg: 'bg-purple-100 dark:bg-purple-500/20',
        icon: 'text-purple-600 dark:text-purple-400',
        hover: ''
      },
      yellow: {
        bg: 'bg-yellow-100 dark:bg-yellow-500/20',
        icon: 'text-yellow-600 dark:text-yellow-400',
        hover: ''
      },
      indigo: {
        bg: 'bg-indigo-100 dark:bg-indigo-500/20',
        icon: 'text-indigo-600 dark:text-indigo-400',
        hover: ''
      },
    };

    return colors[color] || colors.blue;
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Admin Dashboard
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Platform management and oversight tools
          </p>
        </div>

        {/* Admin Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminCards.map((card) => {
            const Icon = card.icon;
            const colors = getColorClasses(card.color, card.disabled);
            
            const CardContent = (
              <div
                className={`group p-6 rounded-xl border ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} transition-all duration-200 shadow-md hover:shadow-lg ${!card.disabled && 'hover:-translate-y-1'} ${card.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl shadow-sm transition-all duration-200 group-hover:scale-110 ${colors.bg}`}>
                    <Icon className={`h-7 w-7 ${colors.icon}`} />
                  </div>
                  {card.stats && (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                      {card.stats}
                    </span>
                  )}
                </div>

                <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {card.title}
                </h3>
                
                <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {card.description}
                </p>
              </div>
            );

            if (card.disabled) {
              return <div key={card.title}>{CardContent}</div>;
            }

            return (
              <Link key={card.title} to={card.link}>
                {CardContent}
              </Link>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`p-5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md hover:shadow-lg transition-all duration-200`}>
            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Pending Withdrawals</p>
            <p className={`text-3xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>-</p>
          </div>
          <div className={`p-5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md hover:shadow-lg transition-all duration-200`}>
            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Active Wallets</p>
            <p className={`text-3xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>-</p>
          </div>
          <div className={`p-5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md hover:shadow-lg transition-all duration-200`}>
            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Today's Transactions</p>
            <p className={`text-3xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>-</p>
          </div>
          <div className={`p-5 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md hover:shadow-lg transition-all duration-200`}>
            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Platform Revenue</p>
            <p className={`text-3xl font-bold mt-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>-</p>
          </div>
        </div>

        {/* Info Banner */}
        <div className={`mt-8 rounded-xl border p-5 ${theme === 'dark' ? 'bg-blue-900/20 border-blue-800' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className={`h-6 w-6 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>
                Admin Access Active
              </h3>
              <p className={`mt-1.5 text-sm leading-relaxed ${theme === 'dark' ? 'text-blue-400' : 'text-blue-700'}`}>
                You have full platform management access. All admin actions are logged for security and audit purposes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

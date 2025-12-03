import { useTheme } from '../context/ThemeContext';
import DisputeReviewDashboard from '../components/DisputeReviewDashboard';

const DisputeReviewPage = () => {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'} py-8`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DisputeReviewDashboard />
      </div>
    </div>
  );
};

export default DisputeReviewPage;

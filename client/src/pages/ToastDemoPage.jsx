import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/Button';

/**
 * Toast Demo Page
 * 
 * This page demonstrates all toast notification types and features.
 * Use this as a reference for implementing toasts in your pages.
 */
export default function ToastDemoPage() {
  const { toast } = useToast();
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen p-8 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto">
        <h1 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Toast Notification System Demo
        </h1>
        <p className={`mb-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
          Click the buttons below to see different toast types in action
        </p>

        {/* Toast Types */}
        <div className={`mb-8 p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Toast Types
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Button
                onClick={() => toast.success('Operation completed successfully!')}
                variant="primary"
                className="w-full"
              >
                Success Toast (Green)
              </Button>
              <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Use for: Completed actions, saves, successful operations
              </p>
            </div>

            <div>
              <Button
                onClick={() => toast.error('Something went wrong. Please try again.')}
                variant="danger"
                className="w-full"
              >
                Error Toast (Red)
              </Button>
              <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Use for: Failed operations, errors, validation issues
              </p>
            </div>

            <div>
              <Button
                onClick={() => toast.warning('Please review your input before proceeding')}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                Warning Toast (Amber)
              </Button>
              <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Use for: Warnings, validation messages, attention needed
              </p>
            </div>

            <div>
              <Button
                onClick={() => toast.info('Your data is being synced in the background')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Info Toast (Blue)
              </Button>
              <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Use for: General info, tips, neutral notifications
              </p>
            </div>
          </div>
        </div>

        {/* Duration Examples */}
        <div className={`mb-8 p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Duration Control
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Button
                onClick={() => toast.info('This will disappear in 2 seconds', 2000)}
                variant="secondary"
                className="w-full"
              >
                Quick (2s)
              </Button>
            </div>

            <div>
              <Button
                onClick={() => toast.success('Default duration: 4 seconds')}
                variant="primary"
                className="w-full"
              >
                Normal (4s)
              </Button>
            </div>

            <div>
              <Button
                onClick={() => toast.warning('Click X to dismiss - stays until you close it', 0)}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                Persistent
              </Button>
            </div>
          </div>
        </div>

        {/* Real-World Examples */}
        <div className={`mb-8 p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Real-World Examples
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={() => {
                toast.success('Invoice #1234 sent to customer');
                setTimeout(() => toast.info('Payment confirmation email delivered'), 1000);
              }}
              variant="primary"
              className="w-full"
            >
              Simulate Invoice Sent
            </Button>

            <Button
              onClick={() => {
                toast.error('Failed to process payment. Card declined.');
              }}
              variant="danger"
              className="w-full"
            >
              Simulate Payment Failure
            </Button>

            <Button
              onClick={() => {
                toast.warning('Session expiring in 5 minutes');
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              Session Warning
            </Button>

            <Button
              onClick={() => {
                toast.info('Syncing 47 records...');
                setTimeout(() => toast.success('Sync complete: 47 records updated'), 2000);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Simulate Sync Process
            </Button>
          </div>
        </div>

        {/* Multiple Toasts Test */}
        <div className={`mb-8 p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Multiple Toasts
          </h2>
          
          <Button
            onClick={() => {
              toast.info('Starting batch operation...');
              setTimeout(() => toast.warning('Step 1 completed with warnings'), 500);
              setTimeout(() => toast.success('Step 2 completed successfully'), 1000);
              setTimeout(() => toast.error('Step 3 failed - retrying...'), 1500);
              setTimeout(() => toast.success('Step 3 completed on retry'), 2500);
              setTimeout(() => toast.success('All operations complete!'), 3000);
            }}
            variant="primary"
            className="w-full"
          >
            Test Multiple Toasts (Stacking)
          </Button>
          <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            Shows how multiple toasts stack vertically with smooth transitions
          </p>
        </div>

        {/* Code Examples */}
        <div className={`p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
          <h2 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Usage in Code
          </h2>
          
          <pre className={`p-4 rounded text-sm overflow-x-auto ${theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
{`// 1. Import the hook
import { useToast } from '../context/ToastContext';

// 2. Use in your component
function MyPage() {
  const { toast } = useToast();
  
  const handleSave = async () => {
    try {
      await saveData();
      toast.success('Data saved successfully');
    } catch (err) {
      toast.error('Failed to save data');
    }
  };
  
  return <button onClick={handleSave}>Save</button>;
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}

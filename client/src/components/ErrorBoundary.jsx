import React from 'react';
import { useTheme } from '../context/ThemeContext';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, errorInfo }) {
  const { theme } = useTheme();

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`max-w-2xl w-full p-8 rounded-lg shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Oops! Something went wrong
          </h1>
          <p className={`text-base ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
            We encountered an unexpected error. Don't worry, your data is safe.
          </p>
        </div>

        {error && (
          <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
            <h3 className={`font-semibold mb-2 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
              Error Details:
            </h3>
            <p className={`text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              {error.toString()}
            </p>
            {errorInfo && errorInfo.componentStack && (
              <details className="mt-3">
                <summary className={`cursor-pointer text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  View stack trace
                </summary>
                <pre className={`mt-2 text-xs overflow-auto max-h-48 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleReload}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Reload Page
          </button>
          <button
            onClick={handleGoHome}
            className={`px-6 py-3 rounded-lg transition-colors font-medium ${
              theme === 'dark' 
                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
            }`}
          >
            Go to Home
          </button>
        </div>

        <div className={`mt-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
          <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>
            💡 <strong>Tip:</strong> If this error persists, try clearing your browser cache or contact support at{' '}
            <a href="mailto:support@recordiq.com" className="underline">support@recordiq.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;

import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

/**
 * Protected route component for admin-only pages
 * Redirects non-admin users to dashboard
 */
export default function AdminRoute({ children }) {
  const { isLoaded, isSignedIn, user } = useUser();

  // Wait for Clerk to load
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to sign in if not authenticated
  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  // Check if user has admin role
  const isAdmin = user?.publicMetadata?.role === 'admin';

  // Redirect to dashboard if not admin
  if (!isAdmin) {
    console.warn('[AdminRoute] Access denied: user is not an admin');
    console.log('[AdminRoute] User metadata:', user?.publicMetadata);
    console.log('[AdminRoute] Expected role: "admin", Got:', user?.publicMetadata?.role);
    return <Navigate to="/customer-dashboard" replace />;
  }

  // Render children if user is admin
  return children;
}

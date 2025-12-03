import axios from 'axios';

// Simple API URL configuration - set VITE_API_BASE_URL in environment
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

if (import.meta.env.DEV) {
  console.log('[API] Base URL:', baseURL, '| Mode:', import.meta.env.MODE);
}

// Helper function to get the Clerk token. This assumes Clerk is initialized.
// Simple in-memory token cache to avoid calling Clerk for every request
let _cachedToken = null;
let _cachedAt = 0;
let _cachedSessionId = null;
const TOKEN_TTL = 55 * 1000; // 55 seconds

export const getAuthToken = async () => {
  try {
    // Reuse cached token if fresh and session hasn't changed
    try {
      const session = window?.Clerk?.session;
      const sid = session?.id || null;
      if (_cachedToken && (Date.now() - _cachedAt) < TOKEN_TTL && _cachedSessionId && sid && String(_cachedSessionId) === String(sid)) {
        if (import.meta.env.DEV) console.log('[API] Using cached token');
        return _cachedToken;
      }
      // If session changed, invalidate cached token
      if (_cachedSessionId && sid && String(_cachedSessionId) !== String(sid)) {
        if (import.meta.env.DEV) console.debug('[API] Clerk session changed; invalidating token cache');
        _cachedToken = null;
        _cachedAt = 0;
      }
    } catch (_e) { /* ignore session-check errors */ }

    // Wait for Clerk to be ready
    if (!window.Clerk) {
      if (import.meta.env.DEV) console.warn('[API] Clerk not initialized yet');
      return null;
    }

    // Check if loaded
    if (!window.Clerk.loaded) {
      if (import.meta.env.DEV) console.warn('[API] Clerk not loaded yet');
      return null;
    }

    // Check session
    const session = window.Clerk.session;
    if (!session) {
      if (import.meta.env.DEV) console.warn('[API] No active Clerk session');
      return null;
    }

    if (import.meta.env.DEV) console.log('[API] Getting token for session:', session.id);
    const token = await session.getToken({ template: 'roles-claims' });

    if (!token) {
      console.error('[API] Failed to get token from session');
      return null;
    }

    // Cache token for short TTL
    _cachedToken = token;
    _cachedAt = Date.now();
    try { _cachedSessionId = session?.id || null; } catch (_e) { _cachedSessionId = null; }

    if (import.meta.env.DEV) console.log('[API] Token retrieved successfully');
    return token;
  } catch (error) {
    console.error('[API] Error getting auth token:', error);
    return null;
  }
};

// Helper function to get full URL for uploaded files, handling multiple images
export const getFullImageUrl = (imagePaths, index = 0) => {
  if (!imagePaths || imagePaths.length === 0 || index < 0 || index >= imagePaths.length) {
    return ''; // Return empty string if no images or invalid index
  }
  const imagePath = imagePaths[index];
  if (typeof imagePath !== 'string' || imagePath.trim() === '') return ''; // Ensure it's a non-empty string
  if (imagePath.startsWith('http')) return imagePath; // Already a full URL

  // For Capacitor (mobile apps), always use full URL to backend
  const isCapacitor = window.location.protocol === 'capacitor:' || 
                      window.location.protocol === 'ionic:' ||
                      (window.Capacitor && window.Capacitor.isNativePlatform());
  
  // For development with ngrok, construct full URL to bypass ngrok browser warning
  // For Capacitor, also use full URL since there's no proxy
  if ((import.meta.env.DEV && baseURL && baseURL.includes('ngrok')) || isCapacitor) {
    // Strip /api from baseURL to get the root server URL
    const serverRoot = baseURL.replace('/api', '');
    const fullPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${serverRoot}${fullPath}`;
  }

  // Return a relative path. The browser will request it from the same origin.
  // In development (non-ngrok), Vite's proxy will forward it. 
  // In production, a reverse proxy (like Vercel's) will handle it.
  return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
};

const api = axios.create({
  baseURL,
  headers: {
    // This header is used to bypass the ngrok browser warning page.
    // Set to any value, e.g., "true".
    'ngrok-skip-browser-warning': 'true',
  },
});

// Add a request interceptor to include the token
api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
  
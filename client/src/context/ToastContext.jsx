import { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };
    
    setToasts(prev => [...prev, toast]);
    
    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Convenience methods
  const toast = {
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    info: (message, duration) => addToast(message, 'info', duration),
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toast }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 space-y-2 pointer-events-none">
        {toasts.map((t, index) => (
          <div 
            key={t.id} 
            className="pointer-events-auto"
            style={{ 
              transform: `translateY(${index * 4}px)`,
              transition: 'transform 0.3s ease-out'
            }}
          >
            <Toast
              message={t.message}
              type={t.type}
              onClose={() => removeToast(t.id)}
              duration={0} // We handle duration in the provider
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

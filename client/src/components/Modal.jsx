import React from 'react';
import { useTheme } from '../context/ThemeContext';

const Modal = ({ isOpen, onClose, children }) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const cardBg = theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/50 backdrop-blur-md backdrop-filter"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-5xl p-6 mx-4 border rounded-lg shadow-xl ${cardBg} ${textColor}`}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
      >
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700`}
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
import React from 'react';
import { useTheme } from '../context/ThemeContext';

const CenteredLoader = ({ message = 'Loading...' }) => {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';

  return (
    <div className={`p-12 text-center ${textColor}`}>
      <div className="flex flex-col items-center gap-4">
        <img src="/recordiq.png" alt="Loading" className="h-16 w-16 animate-pulse" />
        <div className="text-base font-medium">{message}</div>
      </div>
    </div>
  );
};

export default CenteredLoader;

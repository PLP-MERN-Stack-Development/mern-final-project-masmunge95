import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { useTheme } from '../context/ThemeContext';

const ConfirmModal = ({ isOpen, title = 'Confirm', message = 'Are you sure?', confirmLabel = 'Yes', cancelLabel = 'Cancel', onConfirm, onCancel, confirmLoading = false }) => {
  const { theme } = useTheme();
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <div className={textColor} role="dialog" aria-modal="true" data-testid="confirm-modal">
        <div className="flex items-start gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.764-1.36 2.722-1.36 3.486 0l5.516 9.82c.75 1.336-.213 2.981-1.743 2.981H4.484c-1.53 0-2.493-1.645-1.743-2.981l5.516-9.82zM11 13a1 1 0 10-2 0 1 1 0 002 0zm-1-8a1 1 0 00-.993.883L9 6v4a1 1 0 001.993.117L11 10V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          <div>
            <div className="text-lg font-medium">{title}</div>
            <div className="mt-2 text-sm">{message}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={confirmLoading}>{cancelLabel}</Button>
          <Button variant="danger" onClick={onConfirm} loading={confirmLoading} disabled={confirmLoading}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;

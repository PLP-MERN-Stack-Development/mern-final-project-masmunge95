import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import Button from './Button';

const RecordVerificationForm = ({ record, onVerified }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verified');
  const [comments, setComments] = useState('');
  const [suggestedCorrections, setSuggestedCorrections] = useState({});
  const [editingField, setEditingField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const extractedFields = record?.extracted || {};
  const recordType = record?.recordType || 'business-record';

  // Get editable fields based on record type
  const getEditableFields = () => {
    switch (recordType) {
      case 'utility':
        return {
          'providerName': 'Provider Name',
          'accountNumber': 'Account Number',
          'meterNumber': 'Meter Number',
          'currentReading': 'Current Reading',
          'previousReading': 'Previous Reading',
          'consumption': 'Consumption',
          'totalAmount': 'Total Amount',
          'dueDate': 'Due Date'
        };
      case 'receipt':
      case 'invoice':
        return {
          'merchantName': 'Merchant Name',
          'totalAmount': 'Total Amount',
          'tax': 'Tax',
          'date': 'Date',
          'invoiceNumber': 'Invoice Number'
        };
      case 'inventory':
        return {
          'itemCount': 'Item Count',
          'totalValue': 'Total Value'
        };
      default:
        return {
          'amount': 'Amount',
          'date': 'Date',
          'description': 'Description'
        };
    }
  };

  const editableFields = getEditableFields();

  const handleFieldEdit = (fieldName, newValue) => {
    setSuggestedCorrections(prev => ({
      ...prev,
      [fieldName]: newValue
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        status,
        comments,
        suggestedCorrections: Object.keys(suggestedCorrections).length > 0 
          ? suggestedCorrections 
          : null
      };

      // api service automatically handles authentication via interceptor
      await api.post(`/records/${record._id}/verify`, payload);

      if (onVerified) {
        onVerified();
      } else {
        navigate('/shared-records');
      }
    } catch (err) {
      console.error('Error verifying record:', err);
      setError(err.response?.data?.message || 'Failed to submit verification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-lg shadow-xl p-6 max-h-[85vh] overflow-y-auto ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
      <div className={`flex items-center justify-between mb-6 sticky top-0 pb-4 border-b z-10 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-2xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          <svg className={`w-7 h-7 ${theme === 'dark' ? 'text-blue-500' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Verify Record
        </h2>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={`p-2 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Status Selection */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Verification Status
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setStatus('verified')}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                status === 'verified'
                  ? theme === 'dark' ? 'border-green-600 bg-green-900/20' : 'border-green-600 bg-green-50'
                  : theme === 'dark' ? 'border-gray-600 hover:border-green-400' : 'border-gray-300 hover:border-green-400'
              }`}
            >
              <svg
                className={`w-8 h-8 mx-auto mb-2 ${
                  status === 'verified' ? 'text-green-600' : 'text-gray-400'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Verify</p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                All information is correct
              </p>
            </button>

            <button
              type="button"
              onClick={() => setStatus('disputed')}
              className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                status === 'disputed'
                  ? theme === 'dark' ? 'border-red-600 bg-red-900/20' : 'border-red-600 bg-red-50'
                  : theme === 'dark' ? 'border-gray-600 hover:border-red-400' : 'border-gray-300 hover:border-red-400'
              }`}
            >
              <svg
                className={`w-8 h-8 mx-auto mb-2 ${
                  status === 'disputed' ? 'text-red-600' : 'text-gray-400'
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Dispute</p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Information needs correction
              </p>
            </button>
          </div>
        </div>

        {/* Extracted Fields */}
        <div className="mb-6">
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Extracted Information
          </h3>
          <div className="space-y-3">
            {Object.entries(editableFields).map(([fieldKey, fieldLabel]) => {
              const currentValue = extractedFields[fieldKey] || 'Not detected';
              const suggestedValue = suggestedCorrections[fieldKey];
              const isEditing = editingField === fieldKey;

              return (
                <div
                  key={fieldKey}
                  className={`flex items-center justify-between p-3 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                >
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      {fieldLabel}
                    </p>
                    {isEditing ? (
                      <input
                        type="text"
                        defaultValue={suggestedValue || currentValue}
                        onBlur={(e) => {
                          handleFieldEdit(fieldKey, e.target.value);
                          setEditingField(null);
                        }}
                        autoFocus
                        className={`mt-1 px-2 py-1 w-full rounded border border-blue-500 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}
                      />
                    ) : (
                      <p className={`mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {suggestedValue || currentValue}
                        {suggestedValue && (
                          <span className={`ml-2 text-xs ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>
                            (Suggested change)
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingField(fieldKey)}
                    className={`ml-4 p-2 ${theme === 'dark' ? 'text-gray-400 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comments */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Comments {status === 'disputed' && <span className="text-red-600">*</span>}
          </label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            placeholder={
              status === 'verified'
                ? 'Optional: Add any additional notes'
                : 'Please explain what needs to be corrected'
            }
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
            required={status === 'disputed'}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={loading || (status === 'disputed' && !comments)}
          >
            {loading ? 'Submitting...' : 'Submit Verification'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/shared-records')}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default RecordVerificationForm;

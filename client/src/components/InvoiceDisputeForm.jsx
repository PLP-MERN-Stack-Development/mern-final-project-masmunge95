import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import Button from './Button';

const InvoiceDisputeForm = ({ invoice, onDisputeSubmitted, onCancel }) => {
  const { theme } = useTheme();
  const [selectedItems, setSelectedItems] = useState([]);
  const [disputeType, setDisputeType] = useState('line-item'); // 'line-item' or 'total'
  const [disputes, setDisputes] = useState([]);
  const [globalReason, setGlobalReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currency = invoice?.currency || 'KSH';

  const handleAddLineItemDispute = (itemIndex) => {
    setDisputes(prev => [
      ...prev,
      {
        lineItemIndex: itemIndex,
        field: 'quantity',
        originalValue: invoice.items[itemIndex].quantity,
        suggestedValue: '',
        reason: ''
      }
    ]);
    setSelectedItems(prev => [...prev, itemIndex]);
  };

  const handleRemoveDispute = (index) => {
    const dispute = disputes[index];
    setDisputes(prev => prev.filter((_, i) => i !== index));
    setSelectedItems(prev => prev.filter(itemIndex => itemIndex !== dispute.lineItemIndex));
  };

  const handleDisputeChange = (index, field, value) => {
    setDisputes(prev => prev.map((d, i) => 
      i === index ? { ...d, [field]: value } : d
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Submit each dispute separately
      const disputesToSubmit = disputeType === 'total' 
        ? [{
            lineItemIndex: null,
            field: 'total',
            originalValue: invoice.total,
            suggestedValue: null,
            reason: globalReason
          }]
        : disputes;

      // api service automatically handles authentication via interceptor
      for (const dispute of disputesToSubmit) {
        await api.post(`/invoices/${invoice._id}/dispute`, dispute);
      }

      if (onDisputeSubmitted) {
        onDisputeSubmitted();
      }
    } catch (err) {
      console.error('Error submitting dispute:', err);
      setError(err.response?.data?.message || 'Failed to submit dispute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-lg shadow-xl p-6 max-h-[85vh] overflow-y-auto ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
      <div className={`flex items-center justify-between mb-6 sticky top-0 pb-4 border-b z-10 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-2xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          <svg className={`w-7 h-7 ${theme === 'dark' ? 'text-yellow-500' : 'text-yellow-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Dispute Invoice
        </h2>
        <button
          onClick={onCancel}
          className={`p-2 transition-colors ${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Dispute Type Selection */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            What would you like to dispute?
          </label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setDisputeType('line-item')}
              className={`flex-1 p-3 rounded-lg border-2 ${
                disputeType === 'line-item'
                  ? theme === 'dark' ? 'border-blue-500 bg-blue-900/20' : 'border-blue-600 bg-blue-50'
                  : theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
              }`}
            >
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Specific Line Items</p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Dispute quantities, prices, or descriptions
              </p>
            </button>
            <button
              type="button"
              onClick={() => setDisputeType('total')}
              className={`flex-1 p-3 rounded-lg border-2 ${
                disputeType === 'total'
                  ? theme === 'dark' ? 'border-blue-500 bg-blue-900/20' : 'border-blue-600 bg-blue-50'
                  : theme === 'dark' ? 'border-gray-600' : 'border-gray-300'
              }`}
            >
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Total Amount</p>
              <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Dispute the overall invoice total
              </p>
            </button>
          </div>
        </div>

        {disputeType === 'line-item' ? (
          <>
            {/* Line Items */}
            <div className="mb-6">
              <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Invoice Line Items
              </h3>
              <div className="space-y-2">
                {invoice.items?.map((item, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                          {item.description}
                        </p>
                        <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                          Qty: {item.quantity} × {currency} {item.unitPrice.toFixed(2)} = {currency} {item.total.toFixed(2)}
                        </p>
                      </div>
                      {!selectedItems.includes(index) && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAddLineItemDispute(index)}
                        >
                          Dispute
                        </Button>
                      )}
                    </div>

                    {/* Dispute Form for this item */}
                    {selectedItems.includes(index) && (
                      <div className={`mt-4 p-4 rounded border ${theme === 'dark' ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200'}`}>
                        {disputes.filter(d => d.lineItemIndex === index).map((dispute, dIndex) => {
                          const globalIndex = disputes.indexOf(dispute);
                          return (
                            <div key={dIndex} className="space-y-3">
                              <div>
                                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                  What's incorrect?
                                </label>
                                <select
                                  value={dispute.field}
                                  onChange={(e) => handleDisputeChange(globalIndex, 'field', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded ${theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                                >
                                  <option value="quantity">Quantity</option>
                                  <option value="unitPrice">Unit Price</option>
                                  <option value="description">Description</option>
                                </select>
                              </div>

                              {dispute.field !== 'description' && (
                                <div>
                                  <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                    Correct Value
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={dispute.suggestedValue}
                                    onChange={(e) => handleDisputeChange(globalIndex, 'suggestedValue', e.target.value)}
                                    placeholder="Enter correct value"
                                    className={`w-full px-3 py-2 border rounded ${theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                                  />
                                </div>
                              )}

                              <div>
                                <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                  Reason <span className="text-red-600">*</span>
                                </label>
                                <textarea
                                  value={dispute.reason}
                                  onChange={(e) => handleDisputeChange(globalIndex, 'reason', e.target.value)}
                                  rows={2}
                                  placeholder="Explain what's wrong"
                                  className={`w-full px-3 py-2 border rounded ${theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                                  required
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveDispute(globalIndex)}
                                className={`text-sm hover:underline ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}
                              >
                                Remove Dispute
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Total Dispute */}
            <div className="mb-6">
              <div className={`p-4 rounded-lg mb-4 ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Invoice Total</p>
                <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {currency} {invoice.total.toFixed(2)}
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Reason for Dispute <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={globalReason}
                  onChange={(e) => setGlobalReason(e.target.value)}
                  rows={4}
                  placeholder="Explain why the total is incorrect"
                  className={`w-full px-4 py-2 border rounded-lg ${theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'}`}
                  required
                />
              </div>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            type="submit"
            variant="primary"
            disabled={loading || (disputeType === 'line-item' && disputes.length === 0) || (disputeType === 'total' && !globalReason)}
          >
            {loading ? 'Submitting...' : 'Submit Dispute'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default InvoiceDisputeForm;

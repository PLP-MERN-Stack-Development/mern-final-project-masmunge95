import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import Button from './Button';

const ServiceForm = ({ onSave, onCancel, serviceToEdit }) => {
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [fees, setFees] = useState([]);

  useEffect(() => {
    if (serviceToEdit) {
      setName(serviceToEdit.name);
      setDetails(serviceToEdit.details || '');
      setUnitPrice(serviceToEdit.unitPrice);
      setFees(serviceToEdit.fees || []);
    }
  }, [serviceToEdit]);

  const handleFeeChange = (index, field, value) => {
    const newFees = [...fees];
    newFees[index][field] = value;
    setFees(newFees);
  };

  const addFee = () => {
    setFees([...fees, { description: '', amount: 0 }]);
  };

  const removeFee = (index) => {
    setFees(fees.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // compute total per unit (unitPrice + sum of fees)
    const feesSum = (fees || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);
    const total = (Number(unitPrice) || 0) + feesSum;
    onSave({ name, details, unitPrice, fees, total });
  };

  // compute live total for display
  const liveFeesSum = (fees || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const liveTotal = ((Number(unitPrice) || 0) + liveFeesSum).toFixed(2);

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const inputBg = theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300';
  const focusRing = 'focus:border-red-500 focus:ring-red-500';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">
      <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto', paddingRight: 12 }}>
      <h2 className={`text-2xl font-bold mb-6 ${textColor}`}>{serviceToEdit ? 'Edit Service' : 'Add New Service'}</h2>
      <div className="space-y-4">
        <div>
          <label htmlFor="service-name" className={`block mb-1 text-sm font-medium ${textColor}`}>Service Name</label>
          <input
            id="service-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`w-full p-2 border rounded ${inputBg} ${focusRing}`}
            required
          />
        </div>
        <div>
          <label htmlFor="service-details" className={`block mb-1 text-sm font-medium ${textColor}`}>Details (Optional)</label>
          <textarea
            id="service-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className={`w-full p-2 border rounded ${inputBg} ${focusRing}`}
            rows="3"
          />
        </div>
        <div>
          <label htmlFor="service-price" className={`block mb-1 text-sm font-medium ${textColor}`}>Unit Price (KSH)</label>
          <input
            id="service-price"
            type="number"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(parseFloat(e.target.value))}
            className={`w-full p-2 border rounded ${inputBg} ${focusRing}`}
            required
          />
        </div>

        <div>
          <h3 className={`text-lg font-semibold mt-4 mb-2 ${textColor}`}>Additional Fees</h3>
            {fees.length > 0 && (
              <div className="grid grid-cols-12 gap-2 text-sm font-medium mb-1">
                <div className="col-span-6">Description</div>
                <div className="col-span-4">Amount (KSH)</div>
                <div className="col-span-2" />
              </div>
            )}
            {fees.map((fee, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 my-2 items-center">
                <div className="col-span-6">
                  <label htmlFor={`fee-desc-${index}`} className="sr-only">Fee Description</label>
                  <input
                    id={`fee-desc-${index}`}
                    type="text"
                    placeholder="Fee Description"
                    value={fee.description}
                    onChange={(e) => handleFeeChange(index, 'description', e.target.value)}
                    className={`w-full p-2 rounded border ${inputBg} ${focusRing}`}
                    required
                  />
                </div>
                <div className="col-span-4">
                  <label htmlFor={`fee-amt-${index}`} className="sr-only">Amount (KSH)</label>
                  <input
                    id={`fee-amt-${index}`}
                    type="number"
                    step="0.01"
                    placeholder="Amount (KSH)"
                    value={fee.amount}
                    onChange={(e) => handleFeeChange(index, 'amount', parseFloat(e.target.value))}
                    className={`w-full p-2 rounded border ${inputBg} ${focusRing}`}
                    required
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button type="button" variant="danger" size="sm" onClick={() => removeFee(index)}>Remove</Button>
                </div>
              </div>
            ))}
          <Button type="button" variant="secondary" onClick={addFee}>
            Add Fee
          </Button>
        </div>
        <div className="mt-4">
          <div className={`text-sm mb-2 ${textColor}`}>Total (per unit, incl. fees)</div>
          <div className={`p-3 rounded border ${inputBg} text-lg font-semibold ${textColor}`}>KSH {liveTotal}</div>
        </div>
      </div>

      </div>
      <div className="flex justify-end gap-4 mt-4">
        <Button type="button" onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          {serviceToEdit ? 'Update Service' : 'Save Service'}
        </Button>
      </div>
    </form>
  );
};

export default ServiceForm;
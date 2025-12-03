import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Utility Reading View - Displays utility bills in a structured format
 * Shows provider, account, meter readings, charges breakdown
 */
const UtilityReadingView = ({ record = {}, editable = false, onSave, onCancel }) => {
  const { theme } = useTheme();
  // Handle nested structure: record.ocrData.extracted or record.extracted
  const ocrData = record.ocrData || {};
  const o = ocrData.extracted || record.extracted || {};
  
  // Parse modelSpecs if it exists (sent separately from the form)
  let modelSpecs = null;
  try {
    if (typeof record.modelSpecs === 'string') {
      modelSpecs = JSON.parse(record.modelSpecs);
    } else if (record.modelSpecs && typeof record.modelSpecs === 'object') {
      modelSpecs = record.modelSpecs;
    }
  } catch (e) {
    console.debug('Could not parse modelSpecs', e);
  }

  const [provider, setProvider] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [billingPeriod, setBillingPeriod] = useState({ start: '', end: '' });
  const [meterReading, setMeterReading] = useState({ previous: '', current: '', consumption: '' });
  const [charges, setCharges] = useState([]);
  const [amountDue, setAmountDue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [total, setTotal] = useState('');
  const [allExtractedData, setAllExtractedData] = useState({});
  const [hasStandardFields, setHasStandardFields] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // ModelSpecs state (for edit mode)
  const [specQ3, setSpecQ3] = useState('');
  const [specPN, setSpecPN] = useState('');
  const [specMaxTemp, setSpecMaxTemp] = useState('');
  const [specOrientation, setSpecOrientation] = useState('');
  const [specMultipliers, setSpecMultipliers] = useState('');

  useEffect(() => {
    setProvider(record.utilityProvider || o.provider || o.utilityProvider || o.manufacturer || '');
    setAccountNumber(record.accountNumber || o.accountNumber || o.account_number || o.serialNumber || o.meterNumber || '');
    setServiceAddress(record.serviceAddress || o.serviceAddress || o.address || '');
    setCustomerName(record.customerName || o.customerName || '');
    setCustomerPhone(record.customerPhone || o.customerPhone || o.phone || '');
    
    // Billing period
    const period = record.statementPeriod || o.statementPeriod || o.billingPeriod || {};
    setBillingPeriod({
      start: period.startDate || period.start || '',
      end: period.endDate || period.end || ''
    });

    // Meter reading
    const meter = record.meterReading || o.meterReading || {};
    setMeterReading({
      previous: meter.previous || meter.previousReading || o.previousReading || '',
      current: meter.current || meter.currentReading || o.mainReading || o.currentReading || '',
      consumption: meter.consumption || meter.usage || o.consumption || ''
    });

    // Charges breakdown
    setCharges(record.charges || o.charges || o.fees || []);
    setAmountDue(record.utilityAmountDue || o.amountDue || o.totalDue || o.mainReading || '');
    setDueDate(record.utilityDueDate || o.dueDate || o.paymentDueDate || '');
    setTotal(record.total || o.total || record.amount || '');
    
    // Combine extracted data with modelSpecs for comprehensive display
    const combinedData = { ...o };
    if (modelSpecs) {
      combinedData.modelSpecs = modelSpecs;
      // Initialize editable modelSpecs fields
      setSpecQ3(modelSpecs.q3 || '');
      setSpecPN(modelSpecs.pn || '');
      setSpecMaxTemp(modelSpecs.maxTemp || '');
      setSpecOrientation(modelSpecs.orientation || '');
      setSpecMultipliers(Array.isArray(modelSpecs.multipliers) ? modelSpecs.multipliers.join(', ') : '');
    }
    setAllExtractedData(combinedData);
    
    // Check if we have any standard utility bill fields
    const hasUtilityFields = !!(
      (record.utilityProvider || o.provider || o.utilityProvider) ||
      (record.utilityAmountDue || o.amountDue || o.totalDue) ||
      (o.charges && o.charges.length > 0) ||
      (o.fees && o.fees.length > 0)
    );
    setHasStandardFields(hasUtilityFields);
  }, [record, o, modelSpecs]);

  const container = `p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} shadow-lg`;

  if (!editable) {
    return (
      <div className={container}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-700/50 dark:border-gray-600/50">
          <div>
            <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {provider || 'Utility Provider'}
            </h3>
            {serviceAddress && (
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Service Address: {serviceAddress}
              </p>
            )}
            {accountNumber && (
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Account #: {accountNumber}
              </p>
            )}
          </div>
          <div className="text-right">
            {/* Date, Customer, Phone */}
            <div className={`text-sm mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              <div className="mb-2">
                <strong>Date</strong>
                <p className="mt-1">{record.recordDate ? new Date(record.recordDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
              </div>
              <div className="mb-2">
                <strong>Customer</strong>
                <p className="mt-1">{customerName || '—'}</p>
              </div>
              <div className="mb-2">
                <strong>Phone</strong>
                <p className="mt-1">{customerPhone || '—'}</p>
              </div>
            </div>
            {(billingPeriod.start || billingPeriod.end) && (
              <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>Billing Period</strong>
                <p className="mt-1">
                  {billingPeriod.start ? new Date(billingPeriod.start).toLocaleDateString() : '—'} to{' '}
                  {billingPeriod.end ? new Date(billingPeriod.end).toLocaleDateString() : '—'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Meter Reading */}
        {(meterReading.previous || meterReading.current || meterReading.consumption) && (
          <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-blue-50'}`}>
            <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-900'}`}>
              Meter Reading
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Previous</p>
                <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {meterReading.previous || '—'}
                </p>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Current</p>
                <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {meterReading.current || '—'}
                </p>
              </div>
              <div>
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Consumption</p>
                <p className={`text-lg font-bold ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                  {meterReading.consumption || '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Charges Breakdown */}
        {charges && charges.length > 0 && (
          <div className="mb-6">
            <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
              Charges Breakdown
            </h4>
            <div className="space-y-2">
              {charges.map((charge, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    {charge.description || charge.name || `Charge ${i + 1}`}
                  </span>
                  <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {charge.amount || charge.value || '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total & Due Date */}
        <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex justify-between items-center mb-4">
            <span className={`text-lg ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Amount Due
            </span>
            <span className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {amountDue || total || '—'}
            </span>
          </div>
          {dueDate && (
            <div className={`text-center p-3 rounded-lg ${theme === 'dark' ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-700'}`}>
              <strong>Due Date:</strong> {new Date(dueDate).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Generic Extracted Data Display - for non-standard utility records like meter readings */}
        {!hasStandardFields && Object.keys(allExtractedData).length > 0 && (
          <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <h4 className={`font-semibold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
              Extracted Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(allExtractedData).map(([key, value]) => {
                if (!value || key === 'rawDriverResponse') return null;
                
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                
                // Handle different value types
                let displayValue = value;
                if (typeof value === 'object' && !Array.isArray(value)) {
                  // For objects, show key-value pairs nicely
                  displayValue = (
                    <div className="space-y-1 mt-2">
                      {Object.entries(value).map(([k, v]) => {
                        if (!v) return null;
                        const subLabel = k.replace(/([A-Z_])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        return (
                          <div key={k} className="flex justify-between">
                            <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                              {subLabel}:
                            </span>
                            <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                              {Array.isArray(v) ? v.join(', ') : String(v)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                } else if (Array.isArray(value)) {
                  displayValue = value.join(', ');
                } else {
                  displayValue = String(value);
                }
                
                return (
                  <div key={key} className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-blue-50'}`}>
                    <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-blue-300' : 'text-blue-900'} mb-1`}>
                      {label}
                    </p>
                    {typeof displayValue === 'string' ? (
                      <p className={`text-base ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {displayValue}
                      </p>
                    ) : displayValue}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Editable mode
  const handleSave = async () => {
    const localUpdate = {
      utilityProvider: provider,
      accountNumber,
      serviceAddress,
      statementPeriod: billingPeriod,
      meterReading,
      charges,
      utilityAmountDue: amountDue,
      utilityDueDate: dueDate,
      total: total || amountDue,
      customerName,
      customerPhone,
      syncStatus: 'pending',
      // Include modelSpecs if edited
      modelSpecs: {
        q3: specQ3 || '',
        pn: specPN || '',
        maxTemp: specMaxTemp || '',
        orientation: specOrientation || '',
        multipliers: specMultipliers ? specMultipliers.split(',').map(m => m.trim()).filter(m => m) : []
      }
    };
    if (typeof onSave === 'function') {
      await onSave(localUpdate);
    }
  };

  return (
    <div className={container}>
      <div className="space-y-4">
        <h3 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Edit Record Details</h3>
        
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Utility Provider / Manufacturer</label>
          <input
            type="text"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            placeholder="Utility Provider"
            className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
          />
        </div>
        
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Account Number / Serial Number</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="Account Number"
            className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
          />
        </div>
        
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Service Address</label>
          <input
            type="text"
            value={serviceAddress}
            onChange={(e) => setServiceAddress(e.target.value)}
            placeholder="Service Address"
            className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
          />
        </div>

        {/* Meter Reading Section */}
        <div className={`p-4 border rounded-lg ${theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
          <h4 className={`text-md font-semibold mb-3 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>Meter Reading</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Previous</label>
              <input
                type="text"
                value={meterReading.previous}
                onChange={(e) => {
                  const newPrev = e.target.value;
                  setMeterReading(prev => {
                    const updated = { ...prev, previous: newPrev };
                    // Auto-calculate consumption if both previous and current exist
                    if (newPrev && prev.current) {
                      const prevNum = parseFloat(newPrev.replace(/[^0-9.]/g, ''));
                      const currNum = parseFloat(prev.current.replace(/[^0-9.]/g, ''));
                      if (!isNaN(prevNum) && !isNaN(currNum) && currNum >= prevNum) {
                        updated.consumption = (currNum - prevNum).toString();
                      }
                    }
                    return updated;
                  });
                }}
                placeholder="Previous reading"
                className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Current</label>
              <input
                type="text"
                value={meterReading.current}
                onChange={(e) => {
                  const newCurr = e.target.value;
                  setMeterReading(prev => {
                    const updated = { ...prev, current: newCurr };
                    // Auto-calculate consumption if both previous and current exist
                    if (prev.previous && newCurr) {
                      const prevNum = parseFloat(prev.previous.replace(/[^0-9.]/g, ''));
                      const currNum = parseFloat(newCurr.replace(/[^0-9.]/g, ''));
                      if (!isNaN(prevNum) && !isNaN(currNum) && currNum >= prevNum) {
                        updated.consumption = (currNum - prevNum).toString();
                      }
                    }
                    return updated;
                  });
                }}
                placeholder="Current reading"
                className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
            <div>
              <label className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Consumption</label>
              <input
                type="text"
                value={meterReading.consumption}
                onChange={(e) => setMeterReading(prev => ({ ...prev, consumption: e.target.value }))}
                placeholder="Auto-calculated or manual"
                className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Period Start</label>
            <input
              type="date"
              value={billingPeriod.start ? new Date(billingPeriod.start).toISOString().split('T')[0] : ''}
              onChange={(e) => setBillingPeriod(prev => ({ ...prev, start: e.target.value }))}
              className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
          <div>
            <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Period End</label>
            <input
              type="date"
              value={billingPeriod.end ? new Date(billingPeriod.end).toISOString().split('T')[0] : ''}
              onChange={(e) => setBillingPeriod(prev => ({ ...prev, end: e.target.value }))}
              className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Amount Due</label>
            <input
              type="number"
              step="0.01"
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
              placeholder="Amount due"
              className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
          <div>
            <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Due Date</label>
            <input
              type="date"
              value={dueDate ? new Date(dueDate).toISOString().split('T')[0] : ''}
              onChange={(e) => setDueDate(e.target.value)}
              className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
            />
          </div>
        </div>

        {/* Model Specifications - Editable */}
        {modelSpecs && (
          <div className={`p-4 mt-4 border rounded-lg ${theme === 'dark' ? 'border-gray-600 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <h4 className={`text-md font-semibold mb-3 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>Device Specifications</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Q3 (Flow Rate)</label>
                <input
                  type="text"
                  value={specQ3}
                  onChange={(e) => setSpecQ3(e.target.value)}
                  placeholder="e.g., Qn 1.5 m³/h"
                  className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>
              <div>
                <label className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>PN (Pressure)</label>
                <input
                  type="text"
                  value={specPN}
                  onChange={(e) => setSpecPN(e.target.value)}
                  placeholder="e.g., 16 bar"
                  className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>
              <div>
                <label className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Max Temperature</label>
                <input
                  type="text"
                  value={specMaxTemp}
                  onChange={(e) => setSpecMaxTemp(e.target.value)}
                  placeholder="e.g., 90℃"
                  className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>
              <div>
                <label className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Orientation</label>
                <select
                  value={specOrientation}
                  onChange={(e) => setSpecOrientation(e.target.value)}
                  className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                >
                  <option value="">Select orientation</option>
                  <option value="A-vertical">A - Vertical</option>
                  <option value="B-horizontal">B - Horizontal</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Multipliers (comma-separated)</label>
                <input
                  type="text"
                  value={specMultipliers}
                  onChange={(e) => setSpecMultipliers(e.target.value)}
                  placeholder="e.g., X0.0001, X0.001"
                  className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => { if (typeof onCancel === 'function') onCancel(); }}
            className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default UtilityReadingView;

import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Customer Record View - Displays customer consumption records
 * Shows customer info, service details, consumption history
 */
const CustomerRecordView = ({ record = {}, editable = false, onSave, onCancel }) => {
  const { theme } = useTheme();
  // Handle nested structure: record.ocrData.extracted or record.extracted
  const ocrData = record.ocrData || {};
  const o = ocrData.extracted || record.extracted || {};

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [service, setService] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [consumptionData, setConsumptionData] = useState([]);
  const [totalConsumption, setTotalConsumption] = useState('');
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [allExtractedData, setAllExtractedData] = useState({});
  const [hasStandardFields, setHasStandardFields] = useState(false);

  useEffect(() => {
    setCustomerName(record.customerName || o.customerName || '');
    setCustomerPhone(record.customerPhone || o.customerPhone || o.phone || '');
    setAccountNumber(record.accountNumber || o.accountNumber || '');
    setService(record.service || o.service || o.serviceType || '');
    setServiceAddress(record.serviceAddress || o.serviceAddress || o.address || '');
    setConsumptionData(record.consumptionData || o.consumptionData || o.readings || []);
    setTotalConsumption(record.totalConsumption || o.totalConsumption || record.total || '');
    
    const periodData = record.period || o.period || record.statementPeriod || {};
    setPeriod({
      start: periodData.start || periodData.startDate || '',
      end: periodData.end || periodData.endDate || ''
    });
    
    // Store all extracted data for fallback display
    setAllExtractedData(o || {});
    
    // Check if we have standard customer consumption fields
    const hasCustomerFields = !!(
      (record.customerName || o.customerName) ||
      (record.consumptionData || o.consumptionData || o.readings) ||
      (record.totalConsumption || o.totalConsumption)
    );
    setHasStandardFields(hasCustomerFields);
  }, [record, o]);

  const container = `p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} shadow-lg`;

  if (!editable) {
    return (
      <div className={container}>
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-gray-700/50 dark:border-gray-600/50">
          <div className="flex items-start justify-between">
            <div>
              <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Customer Consumption Record
              </h3>
              <p className={`text-lg mt-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                {customerName || 'Customer'}
              </p>
              {customerPhone && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Phone: {customerPhone}
                </p>
              )}
            </div>
            <div className="text-right">
              {service && (
                <div className={`px-3 py-1 rounded-lg ${theme === 'dark' ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-100 text-blue-800'}`}>
                  {service}
                </div>
              )}
              {accountNumber && (
                <p className={`text-sm mt-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  Account: {accountNumber}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Service Address */}
        {serviceAddress && (
          <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Service Address</p>
            <p className={`text-base font-medium mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {serviceAddress}
            </p>
          </div>
        )}

        {/* Period */}
        {(period.start || period.end) && (
          <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-purple-900/20 border border-purple-700/30' : 'bg-purple-50 border border-purple-200'}`}>
            <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-purple-300' : 'text-purple-900'}`}>
              Consumption Period
            </p>
            <p className={`text-base mt-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {period.start ? new Date(period.start).toLocaleDateString() : '—'} to{' '}
              {period.end ? new Date(period.end).toLocaleDateString() : '—'}
            </p>
          </div>
        )}

        {/* Consumption Data */}
        {consumptionData && consumptionData.length > 0 && (
          <div className="mb-6">
            <h4 className={`font-semibold mb-3 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
              Consumption History
            </h4>
            <div className="space-y-2">
              {consumptionData.map((entry, i) => (
                <div 
                  key={i} 
                  className={`p-3 rounded-lg flex justify-between items-center ${theme === 'dark' ? 'bg-gray-700/30 hover:bg-gray-700/50' : 'bg-gray-50 hover:bg-gray-100'} transition-colors`}
                >
                  <div>
                    <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {entry.date ? new Date(entry.date).toLocaleDateString() : entry.period || `Entry ${i + 1}`}
                    </p>
                    {entry.description && (
                      <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {entry.consumption || entry.usage || entry.amount || '—'}
                    </p>
                    {entry.unit && (
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        {entry.unit}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total Consumption */}
        {totalConsumption && (
          <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex justify-between items-center">
              <span className={`text-lg font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Total Consumption
              </span>
              <span className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {totalConsumption}
              </span>
            </div>
          </div>
        )}

        {/* Generic Extracted Data Display */}
        {!hasStandardFields && Object.keys(allExtractedData).length > 0 && (
          <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <h4 className={`font-semibold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
              Extracted Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(allExtractedData).map(([key, value]) => {
                if (!value || key === 'rawDriverResponse') return null;
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                
                let displayValue = value;
                if (typeof value === 'object' && !Array.isArray(value)) {
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
                  <div key={key} className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-purple-50'}`}>
                    <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-purple-300' : 'text-purple-900'} mb-1`}>
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
      customerName,
      customerPhone,
      accountNumber,
      service,
      serviceAddress,
      consumptionData,
      totalConsumption,
      period,
      syncStatus: 'pending',
    };
    if (typeof onSave === 'function') {
      await onSave(localUpdate);
    }
  };

  return (
    <div className={container}>
      <div className="space-y-4">
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Customer Name"
          className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
        />
        <input
          type="text"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="Phone Number"
          className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
        />
        <input
          type="text"
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="Service Type"
          className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
        />

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

export default CustomerRecordView;

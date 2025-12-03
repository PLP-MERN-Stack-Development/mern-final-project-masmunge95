import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Inventory View - Displays inventory/stock lists in a grid format
 * Shows items with quantities, SKUs, and values
 */
const InventoryView = ({ record = {}, editable = false, onSave, onCancel }) => {
  const { theme } = useTheme();
  // Handle nested structure: record.ocrData.extracted or record.extracted
  const ocrData = record.ocrData || {};
  const o = ocrData.extracted || record.extracted || {};

  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [stockDate, setStockDate] = useState('');
  const [items, setItems] = useState([]);
  const [totalValue, setTotalValue] = useState('');
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [allExtractedData, setAllExtractedData] = useState({});
  const [hasStandardFields, setHasStandardFields] = useState(false);

  useEffect(() => {
    setBusinessName(record.businessName || o.businessName || o.storeName || '');
    setLocation(record.location || o.location || o.warehouse || '');
    setStockDate(record.stockDate || o.stockDate || record.recordDate || '');
    setItems((record.items || o.items || []).map(it => ({ ...it })));
    setTotalValue(record.totalValue || o.totalValue || '');

    // Calculate total quantity
    const qty = (record.items || o.items || []).reduce((sum, item) => {
      return sum + (Number(item.quantity) || 0);
    }, 0);
    setTotalQuantity(qty);
    
    // Store all extracted data for fallback display
    setAllExtractedData(o || {});
    
    // Check if we have standard inventory fields
    const hasInventoryFields = !!(
      (record.items || o.items)?.length > 0 ||
      (record.businessName || o.businessName || o.storeName)
    );
    setHasStandardFields(hasInventoryFields);
  }, [record, o]);

  const container = `p-6 rounded-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'} shadow-lg`;

  if (!editable) {
    return (
      <div className={container}>
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-700/50 dark:border-gray-600/50">
          <div>
            <h3 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {businessName || 'Inventory List'}
            </h3>
            {location && (
              <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                Location: {location}
              </p>
            )}
          </div>
          <div className="text-right">
            {stockDate && (
              <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                <strong>Stock Date</strong>
                <p className="mt-1">{new Date(stockDate).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>Total Items</p>
            <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {items.length}
            </p>
          </div>
          <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200'}`}>
            <p className={`text-sm ${theme === 'dark' ? 'text-green-300' : 'text-green-700'}`}>Total Quantity</p>
            <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {totalQuantity}
            </p>
          </div>
        </div>

        {/* Items Grid */}
        {items && items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-100'}>
                  <th className={`p-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                    Item / SKU
                  </th>
                  <th className={`p-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                    Quantity
                  </th>
                  <th className={`p-3 text-right text-sm font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                    Unit Price
                  </th>
                  <th className={`p-3 text-right text-sm font-semibold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                    Total Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr 
                    key={i} 
                    className={`border-b ${theme === 'dark' ? 'border-gray-700 hover:bg-gray-700/30' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                  >
                    <td className={`p-3 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
                      <div>
                        <p className="font-medium">{item.description || item.name || item.item || '—'}</p>
                        {(item.sku || item.code) && (
                          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            SKU: {item.sku || item.code}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className={`p-3 text-center font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {item.quantity || item.qty || '—'}
                    </td>
                    <td className={`p-3 text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      {item.unitPrice || item.price || '—'}
                    </td>
                    <td className={`p-3 text-right font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {item.totalValue || item.total || item.amount || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
            No inventory items detected.
          </div>
        )}

        {/* Total */}
        {totalValue && (
          <div className={`mt-6 pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex justify-between items-center">
              <span className={`text-lg font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Total Inventory Value
              </span>
              <span className={`text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                {totalValue}
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
                  <div key={key} className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-green-50'}`}>
                    <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-green-300' : 'text-green-900'} mb-1`}>
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

  // Editable mode (simplified for now)
  const handleSave = async () => {
    const localUpdate = {
      businessName,
      location,
      stockDate,
      items,
      totalValue,
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
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Business Name"
          className={`w-full p-3 border rounded-lg ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location/Warehouse"
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

export default InventoryView;

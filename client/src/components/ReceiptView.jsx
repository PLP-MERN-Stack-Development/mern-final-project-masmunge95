import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

// ReceiptView can render read-only preview or an inline editable form when `editable` is true.
// Props:
// - record: the record object
// - editable: boolean
// - onSave: async callback(updatedFields) => persists changes
// - onCancel: cancel editing
const ReceiptView = ({ record = {}, editable = false, onSave, onCancel }) => {
  const { theme } = useTheme();
  // Handle nested structure: record.ocrData.extracted or record.extracted
  const ocrData = record.ocrData || {};
  const o = ocrData.extracted || record.extracted || {};

  const [localBusinessName, setLocalBusinessName] = useState('');
  const [localBusinessAddress, setLocalBusinessAddress] = useState('');
  const [localInvoiceId, setLocalInvoiceId] = useState('');
  const [localInvoiceDate, setLocalInvoiceDate] = useState('');
  const [localTxnId, setLocalTxnId] = useState('');
  const [localApartment, setLocalApartment] = useState('');
  const [localCounty, setLocalCounty] = useState('');
  const [items, setItems] = useState([]);
  const [fees, setFees] = useState([]);
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [total, setTotal] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  useEffect(() => {
    setLocalBusinessName(record.businessName || o.businessName || o.merchantName || '');
    setLocalBusinessAddress(record.businessAddress || o.businessAddress || '');
    setLocalInvoiceId(record.invoiceId || o.invoiceNo || o.invoice_id || '');
    setLocalInvoiceDate(record.invoiceDate || o.invoiceDate || o.invoice_date || '');
    setLocalTxnId(record.transactionId || o.transactionId || o.txnId || '');
    setLocalApartment(record.apartment || o.apartment || '');
    setLocalCounty(record.county || o.county || '');
    setItems((record.items && record.items.length) ? record.items.map(it => ({ ...it })) : (o.items || []).map(it => ({ ...it })));
    setFees((record.fees && record.fees.length) ? record.fees.map(f => ({ ...f })) : (o.fees || []).map(f => ({ ...f })));
    setSubtotal(record.subtotal ?? o.subtotal ?? '');
    setTax(record.tax ?? o.tax ?? '');
    setTotal(record.total ?? o.total ?? record.amount ?? '');
    setPaymentMethod(record.paymentMethod || o.paymentMethod || '');
  }, [record]);

  // recompute subtotal/total when items/fees/tax change
  useEffect(() => {
    try {
      const computedSubtotal = (items || []).reduce((acc, item) => {
        const qty = Number(item.quantity ?? 1) || 1;
        const totalFromFields = Number(item.totalPrice ?? item.amount ?? NaN);
        if (!isNaN(totalFromFields)) return acc + totalFromFields;
        const unit = Number(item.unitPrice ?? NaN);
        if (!isNaN(unit)) return acc + (unit * qty);
        return acc;
      }, 0);
      const feesTotal = (fees || []).reduce((acc, f) => acc + Number(f.amount ?? 0), 0);
      const computedTax = Number(tax || 0);
      const computedTotal = computedSubtotal + feesTotal + computedTax;
      setSubtotal(Number(computedSubtotal || 0).toFixed(2));
      setTotal(Number(computedTotal || 0).toFixed(2));
    } catch (e) {}
  }, [items, fees, tax]);

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const copy = prev.map(it => ({ ...it }));
      copy[index] = { ...(copy[index] || {}), [field]: value };
      // update totalPrice when qty/unitPrice change
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(copy[index].quantity || 0) || 0;
        const unit = Number(copy[index].unitPrice || 0) || 0;
        copy[index].totalPrice = (qty * unit).toFixed(2);
      }
      return copy;
    });
  };

  const handleAddItem = () => setItems(prev => ([...(prev || []), { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]));
  const handleDeleteItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const localUpdate = {
      businessName: localBusinessName,
      businessAddress: localBusinessAddress,
      invoiceId: localInvoiceId,
      invoiceDate: localInvoiceDate,
      transactionId: localTxnId,
      apartment: localApartment,
      county: localCounty,
      items,
      fees,
      subtotal,
      tax,
      total,
      paymentMethod,
      syncStatus: 'pending',
    };
    if (typeof onSave === 'function') {
      await onSave(localUpdate);
    }
  };

  const container = `p-4 rounded-md ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`;

  if (!editable) {
    const displayInvoiceDate = localInvoiceDate ? (new Date(localInvoiceDate).toLocaleDateString()) : '';
    return (
      <div className={container}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{localBusinessName || 'Business'}</div>
            {localBusinessAddress && <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{localBusinessAddress}</div>}
            <div className="mt-2 text-sm text-gray-500">{localTxnId ? `Transaction: ${localTxnId}` : ''}</div>
          </div>
          <div className="text-right">
            {localInvoiceId && <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Invoice #: <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{localInvoiceId}</span></div>}
            {displayInvoiceDate && <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Date: <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{displayInvoiceDate}</span></div>}
            {localApartment && <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Apt: <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{localApartment}</span></div>}
            {localCounty && <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>County: <span className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{localCounty}</span></div>}
          </div>
        </div>

        <div className="mb-4">
          <h4 className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Items</h4>
          {items && items.length > 0 ? (
            <div className="overflow-auto">
              <table className="min-w-full table-auto border-collapse">
                <thead>
                  <tr>
                    <th className={`text-left p-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Description</th>
                    <th className={`text-right p-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Qty</th>
                    <th className={`text-right p-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Unit</th>
                    <th className={`text-right p-2 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className={`${i % 2 === 0 ? (theme === 'dark' ? 'bg-gray-800/40' : 'bg-gray-50') : ''}`}>
                      <td className={`p-2 align-top ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{it.description || it.name || it.item || ''}</td>
                      <td className={`p-2 align-top text-right ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{it.quantity ?? it.qty ?? ''}</td>
                      <td className={`p-2 align-top text-right ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{it.unitPrice ?? it.price ?? ''}</td>
                      <td className={`p-2 align-top text-right font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{it.totalPrice ?? it.total ?? it.amount ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>No items detected.</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-6 mb-4">
          <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Subtotal</div>
          <div className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{subtotal !== '' ? subtotal : '—'}</div>
        </div>
        <div className="flex items-center justify-end gap-6 mb-4">
          <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Tax</div>
          <div className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{tax !== '' ? tax : '—'}</div>
        </div>
        <div className="flex items-center justify-end gap-6">
          <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Total</div>
          <div className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{total !== '' ? total : '—'}</div>
        </div>

        {/* Detected fields */}
        {((record.keyValuePairs || o.keyValuePairs || o.key_values) && (record.keyValuePairs || o.keyValuePairs || o.key_values).length > 0) && (
          <div className="mt-4">
            <h4 className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>Detected Fields</h4>
            <div className={`p-3 rounded ${theme === 'dark' ? 'bg-gray-700/40 text-gray-100' : 'bg-gray-50 text-gray-800'}`}>
              <ul className="list-disc pl-5">
                {(record.keyValuePairs || o.keyValuePairs || o.key_values || []).map((kv, i) => (
                  <li key={i}><strong>{kv.key || kv.name}:</strong> {kv.value}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Editable render
  return (
    <div className={container}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <input type="text" value={localBusinessName} onChange={(e) => setLocalBusinessName(e.target.value)} placeholder="Business Name" className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          <input type="text" value={localBusinessAddress} onChange={(e) => setLocalBusinessAddress(e.target.value)} placeholder="Business Address" className={`w-full mt-2 p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          <div className="mt-2 text-sm text-gray-500">{localTxnId ? `Transaction: ${localTxnId}` : ''}</div>
        </div>
        <div className="w-48 text-right">
          <input type="text" value={localInvoiceId} onChange={(e) => setLocalInvoiceId(e.target.value)} placeholder="Invoice #" className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          <input type="date" value={localInvoiceDate ? (new Date(localInvoiceDate).toISOString().split('T')[0]) : ''} onChange={(e) => setLocalInvoiceDate(e.target.value)} className={`w-full mt-2 p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          <input type="text" value={localApartment} onChange={(e) => setLocalApartment(e.target.value)} placeholder="Apartment" className={`w-full mt-2 p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
          <input type="text" value={localCounty} onChange={(e) => setLocalCounty(e.target.value)} placeholder="County" className={`w-full mt-2 p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
        </div>
      </div>

      <div className="mb-4">
        <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Items</h3>
        <table className="w-full">
          <thead>
            <tr>
              <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Description</th>
              <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Quantity</th>
              <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Unit Price</th>
              <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Total</th>
              <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}><input className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} value={it.description || ''} onChange={(e) => handleItemChange(idx, 'description', e.target.value)} /></td>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}><input className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} value={it.quantity || ''} onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} /></td>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}><input className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} value={it.unitPrice || ''} onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} /></td>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600 bg-gray-700 text-gray-100' : 'border-gray-300 bg-gray-100 text-black'}`}><input className={`w-full p-1 border rounded bg-transparent`} value={it.totalPrice || ''} readOnly /></td>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}><button type="button" onClick={() => handleDeleteItem(idx)} className="px-2 py-1 bg-red-500 text-white rounded">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-right mt-2"><button type="button" onClick={handleAddItem} className="px-3 py-1 bg-green-500 text-white rounded">+ Add Item</button></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Subtotal</label>
          <input type="text" value={subtotal} readOnly className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-gray-100 border-gray-300 text-black'}`} />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Tax</label>
          <input type="text" value={tax} onChange={(e) => setTax(e.target.value)} className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`} />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Total</label>
          <input type="text" value={total} readOnly className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-gray-100 border-gray-300 text-black'}`} />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <button type="button" onClick={() => { if (typeof onCancel === 'function') onCancel(); }} className="px-4 py-2 bg-gray-500 text-white rounded">Cancel</button>
        <button type="button" onClick={handleSave} className="px-4 py-2 bg-red-600 text-white rounded">Save</button>
      </div>
    </div>
  );
};

export default ReceiptView;

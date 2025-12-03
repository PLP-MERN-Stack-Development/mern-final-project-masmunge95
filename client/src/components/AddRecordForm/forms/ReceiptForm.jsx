import React from 'react';

/**
 * Receipt/Invoice form component
 * Handles business receipts and invoices with line items
 */
const ReceiptForm = ({ formState, theme, isSeller, customers, onItemChange, onFeeChange, onPromotionChange }) => {
  const {
    invoiceId, setInvoiceId,
    invoiceDate, setInvoiceDate,
    transactionId, setTransactionId,
    detectedStatementDate, setDetectedStatementDate,
    detectedPeriodStart, setDetectedPeriodStart,
    detectedPeriodEnd, setDetectedPeriodEnd,
    businessName, setBusinessName,
    businessAddress, setBusinessAddress,
    items, setItems,
    fees, setFees,
    subtotal,
    tax, setTax,
    total,
    paymentMethod, setPaymentMethod,
    promotions, setPromotions,
    promotionsParsed, setPromotionsParsed,
  } = formState;

  // Item handlers
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate total price if quantity or unitPrice changes
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = parseFloat(field === 'quantity' ? value : newItems[index].quantity) || 0;
      const price = parseFloat(field === 'unitPrice' ? value : newItems[index].unitPrice) || 0;
      newItems[index].totalPrice = (qty * price).toFixed(2);
    }
    
    setItems(newItems);
    if (onItemChange) onItemChange(index, field, value);
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0, totalPrice: 0 }]);
  };

  const handleDeleteItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Fee handlers
  const handleFeeChange = (index, field, value) => {
    const newFees = [...fees];
    newFees[index] = { ...newFees[index], [field]: value };
    setFees(newFees);
    if (onFeeChange) onFeeChange(index, field, value);
  };

  // Promotion handlers
  const handlePromotionChange = (index, field, value) => {
    const newPromos = [...promotionsParsed];
    newPromos[index] = { ...newPromos[index], [field]: value };
    setPromotionsParsed(newPromos);
    if (onPromotionChange) onPromotionChange(index, field, value);
  };

  const handleAddPromotion = () => {
    setPromotionsParsed([...promotionsParsed, { description: '', amount: 0 }]);
  };

  const handleDeletePromotion = (index) => {
    setPromotionsParsed(promotionsParsed.filter((_, i) => i !== index));
  };

  const parsePromotionsStringToParsed = () => {
    try {
      const parsed = promotions.split(';').map(p => {
        const parts = p.split(':');
        return parts.length >= 2 ? {
          description: parts[0].trim(),
          amount: Number(parts[1].replace(/[^0-9.-]+/g, '').trim() || 0)
        } : null;
      }).filter(Boolean);
      setPromotionsParsed(parsed);
    } catch (e) {
      console.error('Failed to parse promotions:', e);
    }
  };

  return (
    <>
      {/* Invoice Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Invoice #
          </label>
          <input
            type="text"
            placeholder="Invoice #"
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Invoice Date
          </label>
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Transaction ID
          </label>
          <input
            type="text"
            placeholder="Transaction ID"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
      </div>

      {/* Statement Date / Period */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Statement Date
          </label>
          <input
            type="date"
            value={detectedStatementDate}
            onChange={(e) => setDetectedStatementDate(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Period Start
          </label>
          <input
            type="date"
            value={detectedPeriodStart}
            onChange={(e) => setDetectedPeriodStart(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Period End
          </label>
          <input
            type="date"
            value={detectedPeriodEnd}
            onChange={(e) => setDetectedPeriodEnd(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
      </div>

      {/* Business Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Business Name
          </label>
          <input
            type="text"
            placeholder="Business Name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Business Address
          </label>
          <input
            type="text"
            placeholder="Business Address"
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
      </div>

      {/* Items Table */}
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
            {items.map((item, index) => (
              <tr key={index}>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
                  />
                </td>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                  <input
                    type="text"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
                  />
                </td>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                  <input
                    type="text"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
                  />
                </td>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                  <input
                    type="text"
                    value={item.totalPrice}
                    readOnly
                    className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-gray-100 border-gray-300 text-black'}`}
                  />
                </td>
                <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(index)}
                    className="text-sm px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-right mt-2">
          <button
            type="button"
            onClick={handleAddItem}
            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* Fees Section */}
      {fees.length > 0 && (
        <div className="mb-4">
          <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            Fees & Charges
          </h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Description</th>
                <th className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee, index) => (
                <tr key={index}>
                  <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                    <input
                      type="text"
                      value={fee.description}
                      onChange={(e) => handleFeeChange(index, 'description', e.target.value)}
                      className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
                    />
                  </td>
                  <td className={`p-2 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}>
                    <input
                      type="text"
                      value={fee.amount}
                      onChange={(e) => handleFeeChange(index, 'amount', e.target.value)}
                      className={`w-full p-1 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Subtotal
          </label>
          <input
            type="text"
            placeholder="Subtotal"
            value={subtotal}
            readOnly
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-gray-100 border-gray-300 text-black'}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Tax
          </label>
          <input
            type="text"
            placeholder="Tax"
            value={tax}
            onChange={(e) => setTax(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Total
          </label>
          <input
            type="text"
            placeholder="Total"
            value={total}
            readOnly
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-gray-300' : 'bg-gray-100 border-gray-300 text-black'}`}
          />
        </div>
      </div>

      {/* Payment and Promotions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Payment Method
          </label>
          <input
            type="text"
            placeholder="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Promotions / Discounts
          </label>
          {Array.isArray(promotionsParsed) && promotionsParsed.length > 0 ? (
            <div className="space-y-2">
              {promotionsParsed.map((p, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={p.description || ''}
                    onChange={(e) => handlePromotionChange(idx, 'description', e.target.value)}
                    className={`flex-1 p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={p.amount === '' ? '' : p.amount}
                    onChange={(e) => handlePromotionChange(idx, 'amount', e.target.value)}
                    className={`w-28 p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeletePromotion(idx)}
                    className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded"
                  >
                    Delete
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddPromotion}
                  className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                >
                  + Add Promotion
                </button>
              </div>
            </div>
          ) : (
            <div>
              <input
                type="text"
                placeholder="Promotions / Discounts"
                value={promotions}
                onChange={(e) => setPromotions(e.target.value)}
                className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={parsePromotionsStringToParsed}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                >
                  Parse into list
                </button>
                <button
                  type="button"
                  onClick={handleAddPromotion}
                  className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded"
                >
                  + Add Promotion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ReceiptForm;

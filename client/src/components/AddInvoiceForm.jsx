import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import Button from './Button';
import db from '../db'; // Import the Dexie database instance

const AddInvoiceForm = ({ onSaveInvoice, onCancel, invoiceToEdit, saving = false }) => {
  const { theme } = useTheme();
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [customers, setCustomers] = useState([]);
  const [utilityServices, setUtilityServices] = useState([]);
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }]);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await db.customers.toArray(); // Fetch from local DB
        setCustomers(data);
      } catch (error) {
        console.error("Failed to fetch customers:", error);
      }
    };
    fetchCustomers();

    const fetchServices = async () => {
      try {
        const data = await db.utilityServices.toArray(); // Fetch from local DB
        setUtilityServices(data);
      } catch (error) {
        console.error("Failed to fetch utility services:", error);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    if (invoiceToEdit) {
      setCustomerId(invoiceToEdit.customer);
      // Format date for input field
      const formattedDueDate = new Date(invoiceToEdit.dueDate).toISOString().split('T')[0];
      setDueDate(formattedDueDate);
      setItems(invoiceToEdit.items.map(({ _id, ...item }) => item)); // Remove _id from items
    }
  }, [invoiceToEdit]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    if (field === 'quantity' || field === 'unitPrice') {
      const parsed = value === '' || value === null ? '' : parseFloat(value);
      newItems[index][field] = Number.isNaN(parsed) ? '' : parsed;
    } else {
      newItems[index][field] = value;
    }
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleServiceSelect = (serviceId) => {
    if (!serviceId) return;

    const selectedService = utilityServices.find(s => s._id === serviceId);
    if (!selectedService) return;

    // Create the main service item
    const mainItem = {
      description: selectedService.name,
      quantity: 1,
      unitPrice: selectedService.unitPrice,
    };

    // Create items for each fee
    const feeItems = selectedService.fees.map(fee => ({
      description: fee.description,
      quantity: 1,
      unitPrice: fee.amount,
    }));

    // Add the new items to the existing list, replacing any empty items
    const existingNonEmptyItems = items.filter(item => item.description || item.unitPrice > 0);
    setItems([...existingNonEmptyItems, mainItem, ...feeItems]);
  };

  const calculateTotals = () => {
    const subTotal = items.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unitPrice) || 0;
      const itemTotal = qty * price;
      return acc + itemTotal;
    }, 0);
    // Assuming a simple tax calculation for now, can be expanded later
    const tax = 0;
    const total = subTotal + tax;
    return { subTotal, total };
  };

  const { subTotal, total } = calculateTotals();

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalItems = items.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      total: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
    }));

    onSaveInvoice({
      customerId: customerId, // Corrected key
      dueDate,
      items: finalItems, // Send the dynamic items
      subTotal: Number(subTotal) || 0,
      total: Number(total) || 0,
    });
  };

  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const secondaryTextColor = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  const inputBg = theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black';
  const focusRing = 'focus:border-red-500 focus:ring-red-500';
  const itemCardBg = theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300';

  return (
    <form data-cy="add-invoice-form" onSubmit={handleSubmit} className={`p-4 sm:p-6 border rounded ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h2 className={`text-xl font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{invoiceToEdit ? 'Edit Invoice' : 'Add New Invoice'}</h2>
      <div className="mb-4">
        <label htmlFor="invoice-customer" className={`block mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Customer</label>
        <select
          data-cy="invoice-customer"
          id="invoice-customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className={`w-full p-2 border rounded text-sm sm:text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          required
        >
          <option value="">Select a customer</option>
          {customers.map((customer) => (
            <option key={customer._id} value={customer._id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label htmlFor="invoice-dueDate" className={`block mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Due Date</label>
        <input
          data-cy="invoice-dueDate"
          id="invoice-dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={`w-full p-2 border rounded text-sm sm:text-base ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          required
        />
      </div>

      {/* Fee Disclosure */}
      <div className={`mb-4 p-3 rounded-lg border-l-4 ${theme === 'dark' ? 'bg-blue-900/20 border-blue-500' : 'bg-blue-50 border-blue-400'}`}>
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-blue-200' : 'text-blue-900'}`}>
              Payment Processing Fees
            </p>
            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-700'}`}>
              Transaction fees will be added when customers pay this invoice. You receive 100% of the invoice amount.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="invoice-service" className={`block mb-2 ${secondaryTextColor}`}>Quick Add from Service</label>
        <select
          data-cy="invoice-service-select"
          id="invoice-service"
          onChange={(e) => handleServiceSelect(e.target.value)}
          className={`w-full p-2 border rounded text-sm sm:text-base ${inputBg} ${focusRing}`}
        >
          <option value="">Select a service to auto-fill...</option>
          {utilityServices.map((service) => (
            <option key={service._id} value={service._id}>
              {service.name}
            </option>
          ))}
        </select>
      </div>

      <div className="my-6">
        <h3 className={`text-lg font-semibold ${textColor} mb-3`}>Invoice Items</h3>
        
        {/* Desktop Layout */}
        <div className="hidden md:block space-y-2">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-12 gap-2 items-center overflow-x-auto">
              <input
                aria-label={`Description`}
                type="text"
                placeholder="Description"
                value={item.description}
                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                className={`col-span-6 p-2 rounded border text-sm ${inputBg} ${focusRing}`}
                required
              />
              <input
                aria-label={`Quantity`}
                type="number"
                placeholder="Qty"
                value={item.quantity !== undefined && item.quantity !== null ? item.quantity : ''}
                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                className={`col-span-2 p-2 rounded border text-sm ${inputBg} ${focusRing}`}
                required
              />
              <input
                aria-label={`Price`}
                type="number"
                placeholder="Price (KSH)"
                value={item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : ''}
                onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                className={`col-span-2 p-2 rounded border text-sm ${inputBg} ${focusRing}`}
                required
              />
              <div className="col-span-2 flex justify-end">
                <Button type="button" variant="danger" size="sm" onClick={() => removeItem(index)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-3">
          {items.map((item, index) => (
            <div key={index} className={`p-3 rounded border ${itemCardBg} space-y-2`}>
              <div className="flex justify-between items-center gap-2">
                <span className={`text-xs font-semibold ${secondaryTextColor}`}>Item {index + 1}</span>
                <Button type="button" variant="danger" size="sm" onClick={() => removeItem(index)}>Remove</Button>
              </div>
              
              <input
                type="text"
                placeholder="Description"
                value={item.description}
                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                className={`w-full p-2 rounded border text-sm ${inputBg} ${focusRing}`}
                required
              />
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={`text-xs ${secondaryTextColor} block mb-1`}>Quantity</label>
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity !== undefined && item.quantity !== null ? item.quantity : ''}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    className={`w-full p-2 rounded border text-sm ${inputBg} ${focusRing}`}
                    required
                  />
                </div>
                <div>
                  <label className={`text-xs ${secondaryTextColor} block mb-1`}>Unit Price (KSH)</label>
                  <input
                    type="number"
                    placeholder="Price (KSH)"
                    value={item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : ''}
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    className={`w-full p-2 rounded border text-sm ${inputBg} ${focusRing}`}
                    required
                  />
                </div>
              </div>
              
              <div className={`text-right text-sm font-semibold ${textColor} pt-2 border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
                Subtotal: KSH {((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="secondary" onClick={addItem} className="mt-3 w-full md:w-auto" disabled={saving} loading={saving}>+ Add Item</Button>
      </div>

      <div className={`text-right font-bold text-lg ${textColor} py-3 border-t border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        Total: KSH {Number(total).toFixed(2)}
      </div>

        <div className="flex flex-col sm:flex-row justify-start sm:justify-end gap-3 mt-4">
        <Button type="button" onClick={onCancel} variant="secondary" className="w-full sm:w-auto" disabled={saving} loading={saving}>Cancel</Button>
        <Button data-cy="save-invoice" type="submit" variant="primary" className="w-full sm:w-auto" loading={saving} disabled={saving}>{invoiceToEdit ? 'Update Invoice' : 'Save Invoice'}</Button>
      </div>
    </form>
  );
};

export default AddInvoiceForm;

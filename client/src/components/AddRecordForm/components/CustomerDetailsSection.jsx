import React from 'react';

/**
 * Customer details section
 * Displays customer selection and address fields for sellers
 */
const CustomerDetailsSection = ({ formState, customers, theme, isSeller }) => {
  if (!isSeller) return null;

  const {
    customerId, setCustomerId,
    detectedCustomerName, setDetectedCustomerName,
    detectedMobileNumber, setDetectedMobileNumber,
    customerAddress, setCustomerAddress,
  } = formState;

  const handleCustomerAddressChange = (field, value) => {
    setCustomerAddress(prevState => ({
      ...prevState,
      [field]: value
    }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          Customer
        </label>
        <select
          data-cy="record-customer-select"
          aria-label="Customer"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
        >
          <option value="">Select an existing customer (optional)</option>
          {customers.map((customer) => (
            <option key={customer._id} value={customer._id}>
              {customer.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          Detected / Manual Customer Name
        </label>
        <input
          type="text"
          placeholder="Customer name (from OCR or manual)"
          value={detectedCustomerName}
          onChange={(e) => setDetectedCustomerName(e.target.value)}
          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
        />
      </div>

      <div>
        <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
          Detected / Manual Customer Phone
        </label>
        <input
          type="text"
          placeholder="Mobile number (from OCR or manual)"
          value={detectedMobileNumber}
          onChange={(e) => setDetectedMobileNumber(e.target.value)}
          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            Apartment
          </label>
          <input
            type="text"
            placeholder="Apartment"
            value={customerAddress.apartment}
            onChange={(e) => handleCustomerAddressChange('apartment', e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
            County
          </label>
          <input
            type="text"
            placeholder="County"
            value={customerAddress.county}
            onChange={(e) => handleCustomerAddressChange('county', e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
      </div>
    </div>
  );
};

export default CustomerDetailsSection;

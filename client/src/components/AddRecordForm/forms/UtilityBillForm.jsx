import React from 'react';

/**
 * Utility bill form component
 * Handles utility meter readings and specifications
 */
const UtilityBillForm = ({ formState, theme, isSeller }) => {
  const {
    utilityProvider, setUtilityProvider,
    accountNumber, setAccountNumber,
    utilityAmountDue, setUtilityAmountDue,
    utilityDueDate, setUtilityDueDate,
    meterReading, setMeterReading,
    modelSpecs,
    specQ3, setSpecQ3,
    specQ3Q1Ratio, setSpecQ3Q1Ratio,
    specPN, setSpecPN,
    specClass, setSpecClass,
    specMaxTemp, setSpecMaxTemp,
    specOrientation, setSpecOrientation,
    specMultipliers, setSpecMultipliers,
  } = formState;

  return (
    <div className="space-y-4 mb-4">
      <div>
        <label
          htmlFor="provider-name"
          className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Provider Name
        </label>
        <input
          id="provider-name"
          type="text"
          placeholder="e.g., Power & Light Co."
          value={utilityProvider}
          onChange={(e) => setUtilityProvider(e.target.value)}
          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
        />
      </div>

      <div>
        <label
          htmlFor="account-number"
          className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Account Number
        </label>
        <input
          id="account-number"
          type="text"
          placeholder="e.g., 123456789"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
        />
      </div>

      {isSeller && (
        <div>
          <label
            className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
          >
            Amount Due
          </label>
          <input
            data-cy="record-amount-due"
            type="number"
            step="0.01"
            placeholder="e.g., 75.50"
            value={utilityAmountDue}
            onChange={(e) => setUtilityAmountDue(e.target.value)}
            className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
          />
        </div>
      )}

      <div>
        <label
          className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Due Date
        </label>
        <input
          type="date"
          value={utilityDueDate}
          onChange={(e) => setUtilityDueDate(e.target.value)}
          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
        />
      </div>

      <div>
        <label
          className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
        >
          Meter Reading
        </label>
        <input
          type="text"
          placeholder="Enter meter reading"
          value={meterReading}
          onChange={(e) => setMeterReading(e.target.value)}
          className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
        />
      </div>

      {/* Model Specifications */}
      {modelSpecs && (
        <div
          className={`col-span-2 p-4 mt-4 border rounded-lg ${theme === 'dark' ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}`}
        >
          <h4
            className={`text-md font-semibold mb-3 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}
          >
            Device Specifications (Editable)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label
                className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Q3 (Flow Rate)
              </label>
              <input
                type="text"
                placeholder="e.g., Qn 1.5 m³/h"
                value={specQ3}
                onChange={(e) => setSpecQ3(e.target.value)}
                className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-black'}`}
              />
            </div>

            <div>
              <label
                className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Q3/Q1 Ratio
              </label>
              <input
                type="text"
                placeholder="e.g., 80"
                value={specQ3Q1Ratio}
                onChange={(e) => setSpecQ3Q1Ratio(e.target.value)}
                className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-black'}`}
              />
            </div>

            <div>
              <label
                className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
              >
                PN (Pressure)
              </label>
              <input
                type="text"
                placeholder="e.g., 16 bar"
                value={specPN}
                onChange={(e) => setSpecPN(e.target.value)}
                className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-black'}`}
              />
            </div>

            <div>
              <label
                className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Class
              </label>
              <input
                type="text"
                placeholder="e.g., A, B, C"
                value={specClass}
                onChange={(e) => setSpecClass(e.target.value)}
                className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-black'}`}
              />
            </div>

            <div>
              <label
                className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Max Temperature
              </label>
              <input
                type="text"
                placeholder="e.g., 90℃"
                value={specMaxTemp}
                onChange={(e) => setSpecMaxTemp(e.target.value)}
                className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-black'}`}
              />
            </div>

            <div>
              <label
                className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Orientation
              </label>
              <select
                value={specOrientation}
                onChange={(e) => setSpecOrientation(e.target.value)}
                className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-black'}`}
              >
                <option value="">Select orientation</option>
                <option value="A-vertical">A - Vertical</option>
                <option value="B-horizontal">B - Horizontal</option>
              </select>
            </div>

            <div className="col-span-2">
              <label
                className={`block mb-1 text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}
              >
                Multipliers (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g., X0.0001, X0.001"
                value={specMultipliers}
                onChange={(e) => setSpecMultipliers(e.target.value)}
                className={`w-full p-2 text-sm border rounded ${theme === 'dark' ? 'bg-gray-600 border-gray-500 text-white' : 'bg-white border-gray-300 text-black'}`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UtilityBillForm;

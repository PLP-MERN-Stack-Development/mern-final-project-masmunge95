import React from 'react';

/**
 * Dynamic key-value field editor component
 * Used for generic structured documents
 */
const DynamicFieldsEditor = ({ dynamicFields, setDynamicFields, theme }) => {
  if (!dynamicFields || dynamicFields.length === 0) return null;

  const handleFieldChange = (index, value) => {
    const newFields = [...dynamicFields];
    newFields[index].value = value;
    setDynamicFields(newFields);
  };

  return (
    <div className="mb-4">
      <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Detected Fields
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dynamicFields.map((fld, idx) => (
          <div key={idx}>
            <label
              className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
            >
              {fld.key}
            </label>
            <input
              type="text"
              value={fld.value}
              onChange={(e) => handleFieldChange(idx, e.target.value)}
              className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-black'}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default DynamicFieldsEditor;

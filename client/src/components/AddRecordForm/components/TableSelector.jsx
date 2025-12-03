import React, { useMemo, useEffect } from 'react';
import { normalizeHeaderSignature, guessColumnMappings } from '../../../utils/AddRecordForm/dataTransformers';

/**
 * Table selector component with pagination and column mapping
 * Handles multiple tables from OCR with intelligent grouping
 */
const TableSelector = ({
  tables,
  setTables,
  selectedTableIndices,
  setSelectedTableIndices,
  currentPageByGroup,
  setCurrentPageByGroup,
  columnMappings,
  setColumnMappings,
  theme
}) => {
  if (!tables || tables.length === 0) return null;

  // Group tables by header signature for pagination
  const tableGroups = useMemo(() => {
    const groups = {};
    (tables || []).forEach((t, idx) => {
      // Skip completely empty tables
      const hasRows = Array.isArray(t.rows) && t.rows.length > 0;
      const hasNonEmptyRow = hasRows && t.rows.some(r =>
        Object.values(r).some(v => v && String(v).trim() !== '')
      );
      if (!hasRows || !hasNonEmptyRow) return;

      const key = normalizeHeaderSignature(t.headers || []);
      if (!groups[key]) groups[key] = { headers: t.headers || [], items: [] };
      groups[key].items.push({ table: t, index: idx });
    });
    return groups;
  }, [tables]);

  // Initialize column mappings for each group
  useEffect(() => {
    setColumnMappings(prev => {
      const copy = { ...prev };
      Object.keys(tableGroups).forEach(k => {
        if (!copy[k]) {
          const headers = tableGroups[k].headers || [];
          copy[k] = guessColumnMappings(headers);
        }
      });
      return copy;
    });
  }, [tableGroups, setColumnMappings]);

  // Initialize page state for new groups
  useEffect(() => {
    setCurrentPageByGroup(prev => {
      const copy = { ...prev };
      Object.keys(tableGroups).forEach(k => {
        if (copy[k] === undefined) copy[k] = 0;
      });
      return copy;
    });
  }, [tableGroups, setCurrentPageByGroup]);

  const toggleSelectTable = (index) => {
    setSelectedTableIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const selectAllInGroup = (groupKey) => {
    const group = tableGroups[groupKey];
    if (!group) return;
    setSelectedTableIndices(prev => {
      const newSet = new Set(prev);
      group.items.forEach(item => newSet.add(item.index));
      return newSet;
    });
  };

  const deselectAllInGroup = (groupKey) => {
    const group = tableGroups[groupKey];
    if (!group) return;
    setSelectedTableIndices(prev => {
      const newSet = new Set(prev);
      group.items.forEach(item => newSet.delete(item.index));
      return newSet;
    });
  };

  const handleColumnMappingChange = (groupKey, colIndex, value) => {
    setColumnMappings(prev => {
      const copy = { ...prev };
      const arr = Array.isArray(copy[groupKey]) ? [...copy[groupKey]] : [];
      arr[colIndex] = value;
      copy[groupKey] = arr;
      return copy;
    });
  };

  const handleTableNameChange = (tableIndex, value) => {
    const newTables = [...tables];
    newTables[tableIndex] = { ...newTables[tableIndex], name: value };
    setTables(newTables);
  };

  const handleCellChange = (tableIndex, rowIndex, header, value) => {
    const newTables = [...tables];
    newTables[tableIndex].rows[rowIndex][header] = value;
    setTables(newTables);
  };

  return (
    <div className="mb-4">
      <h3 className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Detected Tables
      </h3>
      {Object.keys(tableGroups).map((groupKey, gIdx) => {
        const group = tableGroups[groupKey];
        const page = currentPageByGroup[groupKey] || 0;
        const total = group.items.length;
        const current = group.items[page];

        return (
          <div key={gIdx} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">
                Table Format {gIdx + 1} — Columns: {group.headers.join(', ') || 'N/A'}
              </div>
              <div className="flex items-center gap-2">
                {total > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentPageByGroup(prev => ({
                        ...prev,
                        [groupKey]: Math.max(0, (prev[groupKey] || 0) - 1)
                      }))}
                      className="px-2 py-1 bg-gray-200 rounded"
                    >
                      Prev
                    </button>
                    <span className="text-sm">{page + 1} / {total}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPageByGroup(prev => ({
                        ...prev,
                        [groupKey]: Math.min(total - 1, (prev[groupKey] || 0) + 1)
                      }))}
                      className="px-2 py-1 bg-gray-200 rounded"
                    >
                      Next
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => selectAllInGroup(groupKey)}
                  className="px-2 py-1 bg-green-200 rounded text-sm"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => deselectAllInGroup(groupKey)}
                  className="px-2 py-1 bg-red-200 rounded text-sm"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {current && (
              <div
                data-cy={`detected-table-page-${current.index}`}
                className="mb-3 overflow-auto border rounded"
              >
                <div className="flex items-center justify-between p-2">
                  <div className="text-sm">Page {page + 1} of {total}</div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTableIndices.has(current.index)}
                      onChange={() => toggleSelectTable(current.index)}
                    />
                    <span className="text-sm">Include this table</span>
                  </label>
                </div>

                <div className="p-2">
                  <label
                    className={`block mb-1 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    Table Title
                  </label>
                  <input
                    type="text"
                    value={tables[current.index].name || ''}
                    onChange={(e) => handleTableNameChange(current.index, e.target.value)}
                    className={`w-full p-2 border rounded ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'}`}
                  />
                </div>

                <table className="min-w-full">
                  <thead>
                    {/* Column mapping row */}
                    <tr>
                      {group.headers.map((h, hi) => (
                        <th
                          key={`map-${hi}`}
                          className={`p-1 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}
                        >
                          <select
                            value={(columnMappings[groupKey] && columnMappings[groupKey][hi]) || 'none'}
                            onChange={(e) => handleColumnMappingChange(groupKey, hi, e.target.value)}
                            className="text-xs w-full p-1"
                          >
                            <option value="none">Ignore</option>
                            <option value="description">Description</option>
                            <option value="sku">SKU</option>
                            <option value="quantity">Quantity</option>
                            <option value="unitPrice">Unit Price</option>
                            <option value="total">Total</option>
                          </select>
                        </th>
                      ))}
                    </tr>
                    {/* Header row */}
                    <tr>
                      {group.headers.map((h, hi) => (
                        <th
                          key={hi}
                          className={`p-2 border ${theme === 'dark' ? 'border-gray-600 text-white' : 'border-gray-300 text-black'}`}
                        >
                          {h || `Column ${hi + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.table.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {group.headers.map((h, cIdx) => (
                          <td
                            key={cIdx}
                            className={`p-1 border ${theme === 'dark' ? 'border-gray-600' : 'border-gray-300'}`}
                          >
                            <input
                              type="text"
                              value={row[h] || ''}
                              onChange={(e) => handleCellChange(current.index, rIdx, h, e.target.value)}
                              className={`w-full p-1 border-0 bg-transparent ${theme === 'dark' ? 'text-white' : 'text-black'}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TableSelector;

import { useState, useEffect, useMemo } from 'react';

/**
 * useTableData - Manage table parsing, grouping, and pagination
 * Handles complex table structures from OCR data
 */
export const useTableData = (record) => {
  const [editingTables, setEditingTables] = useState(false);
  const [localTables, setLocalTables] = useState([]);
  const [localSelectedTableIndices, setLocalSelectedTableIndices] = useState(new Set());
  const [localColumnMappings, setLocalColumnMappings] = useState({});
  const [localCurrentPageByGroup, setLocalCurrentPageByGroup] = useState({});
  const [currentPageByGroup, setCurrentPageByGroup] = useState({});

  // Helper: Derive headers from table
  const deriveHeadersFromTable = (table) => {
    try {
      if (table.headers && Array.isArray(table.headers)) return table.headers;
      if (table.cells && Array.isArray(table.cells)) {
        const maxCol = Math.max(...table.cells.map(c => c.columnIndex || 0));
        return Array.from({ length: maxCol + 1 }).map((_, i) => `Column ${i + 1}`);
      }
      return [];
    } catch (e) {
      return [];
    }
  };

  // Helper: Build rows from table cells
  const buildRowsFromTable = (table, headers = []) => {
    try {
      if (table.rows && Array.isArray(table.rows)) return table.rows;
      if (table.cells && Array.isArray(table.cells)) {
        const grid = [];
        const rowCount = Math.max(...table.cells.map(c => c.rowIndex || 0)) + 1;
        const colCount = Math.max(...table.cells.map(c => c.columnIndex || 0)) + 1;

        for (let r = 0; r < rowCount; r++) {
          grid[r] = new Array(colCount).fill('');
        }

        table.cells.forEach(cell => {
          grid[cell.rowIndex][cell.columnIndex] = cell.content || '';
        });

        const rows = [];
        for (let r = 1; r < grid.length; r++) {
          const rowObj = {};
          for (let c = 0; c < (headers.length || grid[r].length); c++) {
            const header = headers[c] || `col_${c}`;
            rowObj[header] = grid[r][c] || '';
          }
          rows.push(rowObj);
        }
        return rows;
      }
      return [];
    } catch (e) {
      return [];
    }
  };

  // Build normalized parsedTables array from record
  const parsedTables = useMemo(() => {
    const src = (record && (record.tables || record.ocrData?.tables)) || [];
    return (src || []).map(t => {
      if (!t) return null;
      const headers = t.headers || (t.rowCount && t.cells ? deriveHeadersFromTable(t) : []);
      const rows = t.rows && Array.isArray(t.rows) ? t.rows : buildRowsFromTable(t, headers);
      const name = t.name || t.title || t.titleText || t.tableTitle || t.caption || null;
      return { headers, rows, name };
    }).filter(Boolean);
  }, [record]);

  // Group tables by header signature for pagination
  const tableGroups = useMemo(() => {
    const groups = {};
    (parsedTables || []).forEach((t, idx) => {
      const key = (t.headers || []).join('||') || `noheaders::${(t.rows || []).length}`;
      if (!groups[key]) {
        groups[key] = { headers: t.headers || [], items: [] };
      }
      groups[key].items.push({ table: t, index: idx });
    });
    return groups;
  }, [parsedTables]);

  // Initialize pagination state when tables change
  useEffect(() => {
    setCurrentPageByGroup(prev => {
      const updated = { ...prev };
      Object.keys(tableGroups).forEach(k => {
        if (!(k in updated)) updated[k] = 0;
      });
      return updated;
    });
  }, [tableGroups]);

  // Reset local state when starting to edit tables
  useEffect(() => {
    if (editingTables) {
      setLocalTables(parsedTables || []);
      setLocalSelectedTableIndices(new Set());
      setLocalColumnMappings({});
      setLocalCurrentPageByGroup({ ...currentPageByGroup });
    }
  }, [editingTables, parsedTables, currentPageByGroup]);

  return {
    parsedTables,
    tableGroups,
    currentPageByGroup,
    setCurrentPageByGroup,
    editingTables,
    setEditingTables,
    localTables,
    setLocalTables,
    localSelectedTableIndices,
    setLocalSelectedTableIndices,
    localColumnMappings,
    setLocalColumnMappings,
    localCurrentPageByGroup,
    setLocalCurrentPageByGroup,
  };
};

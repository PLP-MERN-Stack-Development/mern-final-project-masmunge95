import React from 'react';
import ReceiptView from './ReceiptView';
import UtilityReadingView from './UtilityReadingView';
import InventoryView from './InventoryView';
import InvoiceView from './InvoiceView';
import CustomerRecordView from './CustomerRecordView';

/**
 * Smart component that routes to the appropriate specialized view
 * based on record type
 */
const RecordViewer = ({ record, editable = false, onSave, onCancel }) => {
  const recordType = String(record?.recordType || record?.type || '').toLowerCase();

  // Route to specialized component based on type
  switch (recordType) {
    case 'receipt':
      return <ReceiptView record={record} editable={editable} onSave={onSave} onCancel={onCancel} />;
    
    case 'invoice':
      return <InvoiceView record={record} editable={editable} onSave={onSave} onCancel={onCancel} />;
    
    case 'utility':
    case 'utility-reading':
      return <UtilityReadingView record={record} editable={editable} onSave={onSave} onCancel={onCancel} />;
    
    case 'inventory':
    case 'inventory-list':
      return <InventoryView record={record} editable={editable} onSave={onSave} onCancel={onCancel} />;
    
    case 'customer':
    case 'customer-consumption':
      return <CustomerRecordView record={record} editable={editable} onSave={onSave} onCancel={onCancel} />;
    
    default:
      // Fallback to receipt view for generic documents
      return <ReceiptView record={record} editable={editable} onSave={onSave} onCancel={onCancel} />;
  }
};

export default RecordViewer;

import React from 'react';
import ReceiptView from './ReceiptView';

/**
 * Invoice View - Similar to receipt but with professional invoice styling
 * Invoices typically have more formal structure, terms, payment details
 */
const InvoiceView = ({ record, editable, onSave, onCancel }) => {
  // Reuse ReceiptView component but could be customized further
  // for invoice-specific fields like payment terms, PO numbers, etc.
  return <ReceiptView record={record} editable={editable} onSave={onSave} onCancel={onCancel} />;
};

export default InvoiceView;

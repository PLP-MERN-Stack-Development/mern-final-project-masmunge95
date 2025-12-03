const LABELS = {
  receipt: 'Receipt',
  invoice: 'Invoice',
  utility: 'Utility Reading',
  inventory: 'Inventory / Stock List',
  customer: 'Customer Record',
  'customer-consumption': 'Customer Consumption (Utility Sheets)',
  other: 'Other / Generic Document'
};

const UPLOAD_REASON_LABELS = {
  proof_of_payment: 'Proof of Payment',
  payment: 'Proof of Payment',
  utility: 'Utility Reading',
  utility_reading: 'Utility Reading',
  meter_reading: 'Meter Reading',
  consumption: 'Consumption Record',
  invoice: 'Invoice',
  receipt: 'Receipt',
  other: 'Other'
};

export function getRecordTypeLabel(key) {
  if (!key) return 'Record';
  const k = String(key);
  if (LABELS[k]) return LABELS[k];
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export function getUploadReasonLabel(reason) {
  if (!reason) return 'Not specified';
  const r = String(reason).toLowerCase();
  if (UPLOAD_REASON_LABELS[r]) return UPLOAD_REASON_LABELS[r];
  // Convert snake_case or kebab-case to Title Case
  return reason.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export default getRecordTypeLabel;

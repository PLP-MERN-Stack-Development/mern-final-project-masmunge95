import React, { useEffect, useState } from 'react';
import { on as onEvent, off as offEvent } from '../services/dataSyncService';

const ClearLocalDataModal = () => {
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    const handler = (p) => {
      setPayload(p || {});
      setVisible(true);
    };
    onEvent('confirm:clear-local-data', handler);
    return () => offEvent('confirm:clear-local-data', handler);
  }, []);

  const close = (action) => {
    try {
      if (payload && typeof payload.respond === 'function') payload.respond(action);
    } catch (e) {
      // ignore
    }
    setVisible(false);
    setPayload(null);
  };

  if (!visible) return null;

  const from = payload?.from || 'previous user';
  const to = payload?.to || 'current user';
  const pending = Number(payload?.pendingCount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold mb-2">Clear Local Data?</h3>
        <p className="text-sm text-gray-700 mb-4">It looks like the signed-in user changed from <strong>{from}</strong> to <strong>{to}</strong>.</p>
        <p className="text-sm text-gray-700 mb-4">
          The app detected a different account on this device. Clearing local data prevents mixing records between accounts and protects your privacy.
        </p>
        <p className="text-sm text-gray-600 mb-4">This action will remove locally cached invoices, records, customers, and any pending changes queued for upload. Server data will not be modified by clearing local cache.</p>
        {pending > 0 ? (
          <p className="text-sm text-yellow-700 mb-4">There are <strong>{pending}</strong> pending outgoing change(s) in the local queue. You can attempt to upload them now, or discard them by clearing local data.</p>
        ) : null}
        <div className="flex justify-end gap-3">
          {pending > 0 ? (
            <>
              <button className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => close('cancel')}>Cancel</button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => close('sync')}>Upload Pending</button>
              <button className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700" onClick={() => close('clear')}>Discard Pending & Clear</button>
            </>
          ) : (
            <>
              <button className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => close('cancel')}>Cancel</button>
              <button className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700" onClick={() => close('clear')}>Clear Local Data</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClearLocalDataModal;

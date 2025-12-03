import React, { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Button from './Button';
import * as dataSyncService from '../services/dataSyncService';
import { syncWithServer, clearFailed, clearAll } from '../services/syncService';
import db from '../db';
import Modal from './Modal';

const QueueStatus = ({ onDismiss }) => {
  const { theme } = useTheme();
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [queueLength, setQueueLength] = useState(0);
  const [_checking, setChecking] = useState(true);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [queueItems, setQueueItems] = useState([]);
  const [userHidden, setUserHidden] = useState(false);

  useEffect(() => {
    let mounted = true;

    const updateQueueCount = async () => {
      try {
        const count = await db.syncQueue.count();
        if (mounted) setQueueLength(count);
      } catch (_e) {
        if (mounted) setQueueLength(0);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    updateQueueCount();

    const onStart = () => {
      setSyncing(true);
      setLastError(null);
      // If a new sync run starts, respect that the banner should re-appear
      setUserHidden(false);
    };
    const onFinished = () => {
      setSyncing(false);
      setLastError(null);
      setLastSyncAt(Date.now());
      updateQueueCount();
    };
    const onError = (err) => {
      setSyncing(false);
      try { setLastError(err?.message || String(err)); } catch (e) { setLastError(String(err)); }
      updateQueueCount();
    };

    dataSyncService.on('sync:start', onStart);
    dataSyncService.on('sync:finished', onFinished);
    dataSyncService.on('sync:error', onError);

    // Also attach hooks to incrementally update queue count (use post-hooks)
    const hookCreate = () => { setTimeout(updateQueueCount, 200); };
    const hookDelete = () => { setTimeout(updateQueueCount, 200); };
    try {
      db.syncQueue.hook('created', hookCreate);
      db.syncQueue.hook('deleted', hookDelete);
    } catch (_e) { /* ignore hook attach errors */ }

    return () => {
      mounted = false;
      dataSyncService.off('sync:start', onStart);
      dataSyncService.off('sync:finished', onFinished);
      dataSyncService.off('sync:error', onError);
      try {
        db.syncQueue.hook('created').unsubscribe(hookCreate);
        db.syncQueue.hook('deleted').unsubscribe(hookDelete);
      } catch (_e) { /* ignore unsubscribe errors */ }
    };
  }, []);

  const handleRetry = async () => {
    setLastError(null);
    try {
      setSyncing(true);
      await syncWithServer();
      // optionally refresh full data after queue processed
      try { await dataSyncService.syncAllData(); } catch (e) {}
      setLastSyncAt(Date.now());
    } catch (err) {
      setLastError(err?.message || String(err));
    } finally {
      setSyncing(false);
      const cnt = await db.syncQueue.count();
      setQueueLength(cnt);
    }
  };

  const handleShowQueue = async () => {
    try {
      const items = await db.syncQueue.toArray();
      // Developer convenience — open a modal with human-friendly UI
      console.debug('Sync queue items:', items);
      setQueueItems(items || []);
      setShowQueueModal(true);
    } catch (_e) { /* ignore read errors */ }
  };

  const handleClearFailed = async () => {
    const ok = window.confirm('Clear all permanently-failed sync items? This cannot be undone.');
    if (!ok) return;
    try {
      const count = await clearFailed();
      setQueueItems(await db.syncQueue.toArray());
      const cnt = await db.syncQueue.count();
      setQueueLength(cnt);
      setShowQueueModal(false);
      // quick feedback
      toast.success(`Cleared ${count} failed queue item${count !== 1 ? 's' : ''}.`);
    } catch (e) {
      toast.error('Failed to clear failed queue items: ' + String(e?.message || e));
    }
  };

  const handleClearAll = async () => {
    const ok = window.confirm('Clear all items from the sync queue? This will drop any pending operations.');
    if (!ok) return;
    try {
      const count = await clearAll();
      setQueueItems([]);
      setQueueLength(0);
      setShowQueueModal(false);
      toast.success(`Cleared ${count} queue item${count !== 1 ? 's' : ''}.`);
    } catch (e) {
      toast.error('Failed to clear queue: ' + String(e?.message || e));
    }
  };

  const handleUserDismiss = () => {
    // Allow users to hide the sync banner even if there are pending items.
    // Keep internal state so it stays hidden until a new sync run starts.
    setUserHidden(true);
    if (onDismiss) onDismiss();
  };

  const idle = !syncing && !lastError && queueLength === 0 && !lastSyncAt;
  if (idle || userHidden) return null;

  // Prepare status content depending on state
  let statusContent = null;
  if (syncing) {
    statusContent = (
      <div className="p-4 mb-6 text-sm text-yellow-700 bg-yellow-100 rounded-xl dark:bg-yellow-200 dark:text-yellow-800 flex items-center justify-between" role="status">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582A9 9 0 1019.4 6.018L20 6" />
          </svg>
          <span>
            <span className="font-medium">Syncing...</span> Processing {queueLength} item{queueLength !== 1 ? 's' : ''}.
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onDismiss && (
            <Button onClick={handleUserDismiss} variant="secondary" size="sm">Hide</Button>
          )}
        </div>
      </div>
    );
  } else if (lastError) {
    statusContent = (
      <div className="p-4 mb-6 text-sm text-red-700 bg-red-100 rounded-xl dark:bg-red-200 dark:text-red-800 flex items-center justify-between" role="alert">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728M6 6l12 12" />
          </svg>
          <div>
            <div className="font-medium">Sync failed</div>
            <div className="mt-1">{lastError}</div>
            <div className="mt-1 text-xs text-gray-600">If this persists, check your network or contact support.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRetry} variant="primary" size="sm">Retry</Button>
          <Button onClick={handleShowQueue} variant="secondary" size="sm">Show Queue</Button>
          {onDismiss && (
            <Button onClick={handleUserDismiss} variant="secondary" size="sm">Dismiss</Button>
          )}
        </div>
      </div>
    );
  } else {
    statusContent = (
      <div className="p-4 mb-6 text-sm text-green-700 bg-green-100 rounded-xl dark:bg-green-200 dark:text-green-800 flex items-center justify-between" role="status">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div>
            {queueLength > 0 ? (
              <div><span className="font-medium">Queued:</span> {queueLength} item{queueLength !== 1 ? 's' : ''} waiting to sync.</div>
            ) : (
              <div><span className="font-medium">All caught up.</span> Last synced {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : '—'}.</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {queueLength > 0 && (
            <Button onClick={handleRetry} variant="primary" size="sm">Sync Now</Button>
          )}
          <Button onClick={handleShowQueue} variant="secondary" size="sm">Show Queue</Button>
          {onDismiss && (
            <Button onClick={handleUserDismiss} variant="secondary" size="sm">Dismiss</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {statusContent}
      <Modal isOpen={showQueueModal} onClose={() => setShowQueueModal(false)}>
        <div>
          <h3 className="text-lg font-medium mb-2">Sync Queue</h3>
          <div className="text-sm mb-4">There are {queueItems.length} item{queueItems.length !== 1 ? 's' : ''} in the sync queue.</div>
          <div className="max-h-48 overflow-auto text-xs">
            {queueItems.map((it, idx) => (
              <div key={idx} className="py-1 border-b last:border-b-0">{JSON.stringify(it)}</div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {queueItems.length > 0 && (
              <>
                <Button onClick={handleClearFailed} variant="danger" size="sm">Clear Failed</Button>
                <Button onClick={handleClearAll} variant="danger" size="sm">Clear All</Button>
              </>
            )}
            <Button onClick={() => setShowQueueModal(false)} variant="secondary">Close</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default QueueStatus;

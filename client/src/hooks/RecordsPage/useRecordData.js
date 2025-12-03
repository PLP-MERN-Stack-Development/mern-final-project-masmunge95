import { useState, useEffect } from 'react';
import db from '../../db';
import * as dataSyncService from '../../services/dataSyncService';

/**
 * Custom hook to manage record data from local database
 * Handles loading, filtering by user, real-time updates, and service lookup
 */
export const useRecordData = (user, isLoaded) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serviceLookup, setServiceLookup] = useState({});
  const [showOutdatedPathBanner, setShowOutdatedPathBanner] = useState(false);

  useEffect(() => {
    let mounted = true;

    const readLocalAndSubscribe = async () => {
      try {
        console.debug('[useRecordData] reading local DB, isLoaded:', isLoaded);
        setLoading(true);
        
        // Trigger a sync to fetch latest records from server
        try {
          if (navigator.onLine && isLoaded) {
            console.debug('[useRecordData] Triggering data sync...');
            await dataSyncService.syncAllData();
          }
        } catch (syncErr) {
          console.warn('[useRecordData] Data sync failed (non-fatal):', syncErr);
        }
        
        // Guard against test DB mocks
        const counts = { records: 0, syncQueue: 0 };
        try { if (typeof db.records.count === 'function') counts.records = await db.records.count(); } catch (e) { counts.records = 0; }
        try { if (typeof db.syncQueue.count === 'function') counts.syncQueue = await db.syncQueue.count(); } catch (e) { counts.syncQueue = 0; }
        console.debug('[useRecordData] db counts:', counts);
        
        const local = await db.records.orderBy('recordDate').reverse().toArray();
        
        // Filter local records to the current authenticated user
        const userId = user?.id || user?.userId || null;
        const filtered = Array.isArray(local) && userId
          ? local.filter(r => String(r.user ?? r.userId ?? '') === String(userId))
          : local;
          
        console.debug('[useRecordData] sample records (raw):', local.slice(0,5));
        console.debug('[useRecordData] sample records (filtered for user):', (filtered || []).slice(0,5));
        
        if (!mounted) return;
        setRecords(filtered || []);
        setLoading(false);
        
        // Check if any records have outdated filesystem paths
        const hasOutdatedPaths = (filtered || []).some(r => 
          r.imagePath && (r.imagePath.includes('\\\\') || r.imagePath.includes('D:') || r.imagePath.includes('C:'))
        );
        setShowOutdatedPathBanner(hasOutdatedPaths);

        // Load utility services for name lookup
        const services = await db.utilityServices.toArray();
        const lookup = {};
        services.forEach(s => {
          if (s._id) lookup[s._id] = s.name || s.service || s._id;
        });
        setServiceLookup(lookup);

        // Subscribe to DB changes
        const onChange = async () => {
          const latest = await db.records.orderBy('recordDate').reverse().toArray();
          const userId = user?.id || user?.userId || null;
          const filtered = Array.isArray(latest) && userId
            ? latest.filter(r => String(r.user || r.userId || '') === String(userId))
            : latest;
          if (mounted) setRecords(filtered || []);
        };

        try {
          db.records.hook('created', onChange);
          db.records.hook('updated', onChange);
          db.records.hook('deleted', onChange);
        } catch (_e) { /* ignore hook attach errors */ }

      } catch (err) {
        console.error('[useRecordData] Failed to read local records:', err);
        setError('Failed to load records.');
        setLoading(false);
      }
    };

    readLocalAndSubscribe();

    return () => { mounted = false; };
  }, [user, isLoaded]);

  const reloadLocal = async () => {
    try {
      setLoading(true);
      const local = await db.records.orderBy('recordDate').reverse().toArray();
      const userId = user?.id || user?.userId || null;
      const filtered = Array.isArray(local) && userId 
        ? local.filter(r => String(r.user || r.userId || '') === String(userId)) 
        : local;
      setRecords(filtered || []);
      setError(null);
    } catch (e) {
      console.error('[useRecordData] reloadLocal failed', e);
      setError('Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  return {
    records,
    loading,
    error,
    setError,
    serviceLookup,
    showOutdatedPathBanner,
    setShowOutdatedPathBanner,
    reloadLocal,
  };
};

// Dev-only helper used to capture shallow snapshots of objects before enqueue
// Keeps snapshots in-memory at `window.__producerSnapshots` and also saves to localStorage
export function saveProducerSnapshot(obj, label = 'producer') {
  // Skip in production builds
  if (import.meta.env?.PROD) return;
  
  try {
    if (typeof window === 'undefined') return;
    const now = new Date().toISOString();
    const snapshot = { label, time: now, pathDescriptors: {}, shallow: {} };

    // own property descriptors (shallow) - avoid invoking getters
    try {
      const names = Object.getOwnPropertyNames(obj || {});
      names.forEach((n) => {
        try {
          const desc = Object.getOwnPropertyDescriptor(obj, n);
          snapshot.pathDescriptors[n] = {
            enumerable: !!desc.enumerable,
            configurable: !!desc.configurable,
            hasGetter: typeof desc.get === 'function',
            hasSetter: typeof desc.set === 'function',
            valueType: typeof desc.value,
          };
        } catch (e) {
          snapshot.pathDescriptors[n] = { error: String(e) };
        }
      });
    } catch (e) {
      snapshot.pathDescriptors.__error = String(e);
    }

    // build a shallow serializable copy (own-enumerable only)
    try {
      const safe = {};
      for (const k in obj || {}) {
        try {
          const v = obj[k];
          const t = typeof v;
          if (v == null || t === 'string' || t === 'number' || t === 'boolean') {
            safe[k] = v;
          } else if (v instanceof Date) {
            safe[k] = v.toISOString();
          } else if (Array.isArray(v)) {
            safe[k] = v.map((x) => (x == null || typeof x !== 'object' ? x : String(x)));
          } else {
            safe[k] = String(v);
          }
        } catch (e) {
          safe[k] = `<<unreadable: ${String(e)}>>`;
        }
      }
      snapshot.shallow = safe;
    } catch (e) {
      snapshot.shallowError = String(e);
    }

    // try a structuredClone test to see if it's cloneable
    try {
      // use global structuredClone if available
      if (typeof structuredClone === 'function') {
        structuredClone(obj);
        snapshot.structuredClone = 'ok';
      } else {
        snapshot.structuredClone = 'unavailable';
      }
    } catch (e) {
      snapshot.structuredClone = String(e);
    }

    window.__producerSnapshots = window.__producerSnapshots || [];
    window.__producerSnapshots.push(snapshot);

    try {
      const key = `producer_snapshot_${label}_${now}`;
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch (e) {
      // ignore localStorage errors
    }
  } catch (err) {
    // keep this helper safe - swallow errors
    try { window.__producerDiagError = String(err); } catch (e) {}
  }
}

export default saveProducerSnapshot;

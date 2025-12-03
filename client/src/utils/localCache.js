// Simple localStorage-based cache helpers used for lightweight offline-first UI
export const getCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('[localCache] failed to read key', key, e);
    return null;
  }
};

export const setCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[localCache] failed to write key', key, e);
  }
};

export const removeCache = (key) => {
  try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
};

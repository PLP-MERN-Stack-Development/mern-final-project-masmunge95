// ***********************************************
// Custom commands for Cypress tests
// ***********************************************

// Add custom command for intercepting API calls
Cypress.Commands.add('mockApi', (method, url, response, statusCode = 200) => {
  cy.intercept(method, url, {
    statusCode,
    body: response,
  }).as('apiCall');
});

// Add custom command for clearing IndexedDB
Cypress.Commands.add('clearIndexedDB', () => {
  cy.window().then((win) => {
    return new Promise((resolve) => {
      try {
        // Prefer deleting the known application database by name first
        if (win.indexedDB && typeof win.indexedDB.deleteDatabase === 'function') {
          try { win.indexedDB.deleteDatabase('Recordiq'); } catch (e) { /* ignore */ }
        }

        // If the browser supports listing databases, delete them all
        if (win.indexedDB && typeof win.indexedDB.databases === 'function') {
          try {
            const dbsPromise = win.indexedDB.databases();
            const timed = Promise.race([dbsPromise, new Promise((res) => setTimeout(() => res(null), 500))]);
            timed.then((databases) => {
              if (Array.isArray(databases)) {
                databases.forEach((db) => {
                  try { win.indexedDB.deleteDatabase(db.name); } catch (e) { /* ignore */ }
                });
              }
              resolve();
            }).catch(() => setTimeout(resolve, 200));
          } catch (e) {
            // If listing threw synchronously, resolve after small delay
            setTimeout(resolve, 200);
          }
        } else {
          // Fallback: resolve after a short delay to allow any current transactions to finish
          setTimeout(resolve, 200);
        }
      } catch (e) {
        // Ensure we always resolve the promise to avoid hanging tests
        setTimeout(resolve, 200);
      }
    });
  });
});

// Add custom command for waiting for network idle
Cypress.Commands.add('waitForNetworkIdle', (timeout = 1000) => {
  let networkIdleTimer;
  
  cy.window().then((win) => {
    return new Promise((resolve) => {
      const resetTimer = () => {
        clearTimeout(networkIdleTimer);
        networkIdleTimer = setTimeout(resolve, timeout);
      };
      
      resetTimer();
      
      // Monitor fetch requests
      const originalFetch = win.fetch;
      win.fetch = function(...args) {
        resetTimer();
        return originalFetch.apply(this, args).finally(resetTimer);
      };
    });
  });
});

// Seed IndexedDB helper: prefers direct `window.db` access and falls back to `window.__seedIndexedDB`.
Cypress.Commands.add('seedIndexedDB', (storeName, items = []) => {
  // Ensure window is available
  return cy.window({ timeout: 10000 }).then((win) => {
    if (win && win.db && win.db[storeName] && typeof win.db[storeName].clear === 'function') {
      // Use a raced promise so we never pass a non-resolving Dexie promise to cy.wrap
      const p = (async () => {
        try {
          await win.db[storeName].clear();
          if (items && items.length) await win.db[storeName].bulkAdd(items);
          return 'ok';
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('seedIndexedDB dexie path error', e);
          return 'error';
        }
      })();

      const timed = Promise.race([p, new Promise((res) => setTimeout(() => res('timeout'), 10000))]);
      return cy.wrap(timed, { timeout: 20000 });
    }

    if (win && win.__seedIndexedDB) {
      return cy.wrap(win.__seedIndexedDB(storeName, items), { timeout: 20000 });
    }

    // Nothing to seed — resolve immediately
    cy.log('No client-side DB seeding available');
    return cy.wrap(null);
  });
});

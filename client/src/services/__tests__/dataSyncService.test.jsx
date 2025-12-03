import { describe, it, expect, beforeEach, vi } from 'vitest';
let dataSyncService;
let db;
let syncWithServer;

// Mock modules that dataSyncService imports
vi.mock('../../db', () => {
  const clearMock = vi.fn(() => Promise.resolve());
  return {
    default: {
      invoices: { clear: clearMock },
      records: { clear: clearMock },
      customers: { clear: clearMock },
      payments: { clear: clearMock },
      utilityServices: { clear: clearMock },
      syncQueue: {
        clear: vi.fn(() => Promise.resolve()),
        count: vi.fn(() => Promise.resolve(0)),
      },
    },
    __esModule: true,
  };
});

vi.mock('../syncService', () => ({ syncWithServer: vi.fn(() => Promise.resolve()) }));
vi.mock('../invoiceService', () => ({ getInvoices: vi.fn(() => Promise.resolve([])) }));
vi.mock('../recordService', () => ({ getRecords: vi.fn(() => Promise.resolve([])) }));
vi.mock('../customerService', () => ({ getCustomers: vi.fn(() => Promise.resolve([])) }));
vi.mock('../utilityService', () => ({ getUtilityServices: vi.fn(() => Promise.resolve([])) }));
vi.mock('../api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: { userId: 'new_user' } })) }, __esModule: true }));

beforeEach(async () => {
  // reset localStorage marker
  localStorage.clear();
  vi.clearAllMocks();
  // Import the mocked db and services after mocks have been registered
  const dbMod = await import('../../db');
  db = dbMod.default;
  const syncMod = await import('../syncService');
  syncWithServer = syncMod.syncWithServer;
  // Import the module after mocks have been registered
  dataSyncService = await import('../dataSyncService');
  // reset rate-limit guard so tests can call syncAllData repeatedly
  if (dataSyncService._testHelpers && typeof dataSyncService._testHelpers.resetLastFullSyncAt === 'function') {
    dataSyncService._testHelpers.resetLastFullSyncAt();
    dataSyncService._testHelpers.setMinFullSyncIntervalMs(0);
  }
});

describe('dataSyncService hybrid user-change flows', () => {
  it('auto-clears when no pending outgoing items on sign-in', async () => {
    // arrange: store an old user id
    localStorage.setItem('recordiq_localUserId', 'old_user');
    // make syncQueue.count return 0
    db.syncQueue.count.mockResolvedValue(0);

    // act: call syncAllData (which will call whoami mocked to new_user)
    await dataSyncService.syncAllData();

    // assert: clear was called on primary tables
    expect(db.invoices.clear).toHaveBeenCalled();
    expect(db.records.clear).toHaveBeenCalled();
    expect(localStorage.getItem('recordiq_localUserId')).toBe('new_user');
  });

  it('when pending items exist, modal action "sync" triggers sync then clear', async () => {
    // arrange: store an old user id
    localStorage.setItem('recordiq_localUserId', 'old_user');
    db.syncQueue.count.mockResolvedValue(2);

    // register a listener for the confirm event that responds with 'sync'
    const handlerSync = (payload) => payload.respond('sync');
    dataSyncService.on('confirm:clear-local-data', handlerSync);

    // act
    await dataSyncService.syncAllData();

    // assert: syncWithServer called and clears executed
    expect(syncWithServer).toHaveBeenCalled();
    expect(db.invoices.clear).toHaveBeenCalled();
    dataSyncService.off('confirm:clear-local-data', handlerSync);
  });

  it('when pending items exist, modal action "clear" clears without syncing', async () => {
    localStorage.setItem('recordiq_localUserId', 'old_user');
    db.syncQueue.count.mockResolvedValue(3);

    const handlerClear = (payload) => payload.respond('clear');
    dataSyncService.on('confirm:clear-local-data', handlerClear);

    await dataSyncService.syncAllData();

    expect(syncWithServer).not.toHaveBeenCalled();
    expect(db.invoices.clear).toHaveBeenCalled();
    dataSyncService.off('confirm:clear-local-data', handlerClear);

  });

  it('when pending items exist, sync fails -> do not clear local data', async () => {
    localStorage.setItem('recordiq_localUserId', 'old_user');
    db.syncQueue.count.mockResolvedValue(2);

    // make syncWithServer reject
    syncWithServer.mockRejectedValueOnce(new Error('network error'));

    const handlerFail = (payload) => payload.respond('sync');
    dataSyncService.on('confirm:clear-local-data', handlerFail);

    await dataSyncService.syncAllData();

    // sync attempted but failed; clear should NOT have been called
    expect(syncWithServer).toHaveBeenCalled();
    expect(db.invoices.clear).not.toHaveBeenCalled();
    // cleanup
    dataSyncService.off('confirm:clear-local-data', handlerFail);
  });
});

// Hoisted mocks: ensure these modules are mocked before any app modules are imported
vi.mock('../../services/invoiceService', () => ({
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
}));

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// End hoisted mocks
// NOTE: `db` will be mocked below (after imports) to mirror other integration tests' structure.

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import InvoicesPage from '../../pages/InvoicesPage';
import { ThemeProvider } from '../../context/ThemeContext';
import { ToastProvider } from '../../context/ToastContext';
import db from '../../db';

// Mock db in the style used by other integration tests (mock implementation below)
// Note: `import db from '../../db'` above will return the mocked object.
vi.mock('../../db', () => {
  const createMockTable = () => ({
    toArray: vi.fn(),
    add: vi.fn(),
    put: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    get: vi.fn(),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        first: vi.fn(),
        delete: vi.fn(),
      })),
    })),
    orderBy: vi.fn(() => ({
      reverse: vi.fn(() => ({
        toArray: vi.fn(),
      })),
    })),
  });

  return {
    default: {
      invoices: createMockTable(),
      customers: createMockTable(),
      utilityServices: createMockTable(),
      syncQueue: {
        add: vi.fn(),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
        })),
      },
    },
  };
});

// Simple render wrapper to include providers used by the app
const renderWithProviders = (component) =>
  render(
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          {component}
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );

// Create deterministic local DB and service mocks
const mockInvoices = [
  { _id: 'inv-1', customerId: 'cust-1', customerName: 'John Doe', status: 'draft', total: 100 },
  { _id: 'inv-2', customerId: 'cust-2', customerName: 'Jane Smith', status: 'sent', total: 200 },
];

const mockCustomers = [
  { _id: 'cust-1', name: 'John Doe' },
  { _id: 'cust-2', name: 'Jane Smith' },
];

// Mock db module (Dexie wrapper)
// (The `db` mock is hoisted at the top of the file so it applies before imports)

// Stub invoiceService to avoid network expectations; tests assert local DB/queue calls
// Keep invoiceService mocked via the hoisted mock above; the imported `db` will be the mocked instance.

let mockDeleteFn;

beforeEach(() => {
  vi.clearAllMocks();
  // Desktop viewport to expose action buttons
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
  window.dispatchEvent(new Event('resize'));

  db.invoices.toArray.mockResolvedValue(mockInvoices);
  // make orderBy(...).reverse().toArray() return the same
  db.invoices.orderBy.mockReturnValue({ reverse: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue(mockInvoices) }) });
  // Mock where().equals().delete() flow used by delete handler
  mockDeleteFn = vi.fn().mockResolvedValue(undefined);
  db.invoices.where.mockReturnValue({
    equals: vi.fn().mockReturnValue({
      delete: mockDeleteFn,
      first: vi.fn().mockResolvedValue(undefined),
    }),
  });
  db.customers.toArray.mockResolvedValue(mockCustomers);
  db.utilityServices.toArray.mockResolvedValue([]);

  db.invoices.add.mockResolvedValue(undefined);
  db.invoices.put.mockResolvedValue(undefined);
  db.invoices.update.mockResolvedValue(undefined);
  db.invoices.delete.mockResolvedValue(undefined);
  db.syncQueue.add.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('InvoicesPage Integration (robust)', () => {
  it('shows invoices from local DB', async () => {
    renderWithProviders(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
    });
  });

  it('shows empty state when no invoices exist', async () => {
    db.invoices.toArray.mockResolvedValueOnce([]);
    renderWithProviders(<InvoicesPage />);

    await waitFor(() => {
      // Use a specific heading for the empty state to avoid matching multiple nodes
      expect(screen.getByRole('heading', { name: /no invoices yet/i })).toBeInTheDocument();
    });
  });

  it('creates a new invoice and writes to local DB + queue', async () => {
    renderWithProviders(<InvoicesPage />);
    const user = userEvent.setup();

    // Try to find a create button; app may show a big CTA when no invoices
    const createBtn = screen.queryByRole('button', { name: /create your first invoice|create invoice|new invoice/i }) || (await screen.findByRole('button', { name: /Create Invoice/i }));
    await user.click(createBtn);

    // Wait for customer options to populate
    await waitFor(() => expect(db.customers.toArray).toHaveBeenCalled());

    const customerSelect = await screen.findByLabelText(/customer/i);
    await user.selectOptions(customerSelect, ['cust-1']);
    await user.type(screen.getByLabelText(/description/i), 'Test item');
    await user.type(screen.getByLabelText(/quantity/i), '1');
    await user.type(screen.getByLabelText(/price/i), '100');
    const due = screen.queryByLabelText(/due date/i);
    if (due) await user.type(due, '2030-01-01');

    const save = screen.getByRole('button', { name: /save invoice|create/i });
    await user.click(save);

    await waitFor(() => {
      expect(db.invoices.put).toHaveBeenCalled();
      expect(db.syncQueue.add).toHaveBeenCalled();
    });
  });

  it('shows status on invoice card (flexible matcher)', async () => {
    renderWithProviders(<InvoicesPage />);

    await waitFor(() => expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0));

    // The status may render in different spots; assert that at least one status badge exists on the page
    const statusNodes = screen.getAllByText((c) => /pending|draft|sent|paid/i.test(c));
    expect(statusNodes.length).toBeGreaterThan(0);
  });

  it('deletes invoice by scoping to card and confirming modal', async () => {
    renderWithProviders(<InvoicesPage />);
    const user = userEvent.setup();

    await waitFor(() => expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0));

    const johnElements = screen.getAllByText('John Doe');
    const johnCard = johnElements[0].closest('article') || johnElements[0].closest('div');
    const deleteBtn = within(johnCard).queryAllByRole('button', { name: /delete/i })[0] || screen.getAllByRole('button', { name: /delete/i })[0];
    await user.click(deleteBtn);

    // Modal contains a button labeled exactly 'Delete' — use role to disambiguate
    // Scope to the modal (it has a title like 'Delete Invoice') then click the modal's Delete button
    const modalTitle = await screen.findByText(/delete invoice/i);
    // There may be multiple 'Delete' buttons (card action + modal). pick the last matching button as the modal confirm.
    const deleteBtns = await screen.findAllByRole('button', { name: /^delete$/i });
    const modalDelete = deleteBtns[deleteBtns.length - 1];
    await user.click(modalDelete);

    await waitFor(() => {
      // Verify deletion was called - the code uses db.invoices.delete(id), not where().equals().delete()
      expect(db.invoices.delete).toHaveBeenCalled();
    });
  });
});

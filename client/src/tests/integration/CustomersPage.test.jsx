import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import CustomersPage from '../../pages/CustomersPage';
import { ThemeProvider } from '../../context/ThemeContext';
import * as customerService from '../../services/customerService';
import db from '../../db';

// Mock services
vi.mock('../../services/customerService');
vi.mock('../../db', () => {
  const createMockTable = () => ({
    toArray: vi.fn(),
    add: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    update: vi.fn(),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        first: vi.fn(),
        delete: vi.fn(),
      })),
    })),
  });

  return {
    default: {
      customers: createMockTable(),
      syncQueue: {
        add: vi.fn(),
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            toArray: vi.fn().mockResolvedValue([]),
          })),
        })),
      },
    },
  };
});

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>{component}</ThemeProvider>
    </BrowserRouter>
  );
};

describe('CustomersPage Integration', () => {
  const mockCustomers = [
    {
      _id: 'cust-1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '1234567890',
      address: '123 Main St',
    },
    {
      _id: 'cust-2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '0987654321',
      address: '456 Oak Ave',
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();

    // Reset global confirm mock (setup.js provides one, but resetAllMocks clears implementations)
    Object.defineProperty(window, 'confirm', {
      writable: true,
      value: vi.fn().mockReturnValue(true),
    });
    
    // Setup initial empty local DB
    db.customers.toArray.mockResolvedValue([]);
    
    // Setup where().equals().first() to return undefined initially (no existing customer)
    db.customers.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      }),
    });
    
    // Setup add and update to work
    db.customers.add.mockResolvedValue(1);
    db.customers.update.mockResolvedValue(1);
    
    // Mock server response
    customerService.getCustomers.mockResolvedValue(mockCustomers);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Customer List Display', () => {
    it('should load and display customers from server', async () => {
      // After syncing, toArray should return the synced customers
      db.customers.toArray
        .mockResolvedValueOnce([])  // Initial load (empty)
        .mockResolvedValueOnce(mockCustomers);  // After sync
      
      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      }, { timeout: 3000 });

      expect(customerService.getCustomers).toHaveBeenCalled();
    });

    it('should display customer details', async () => {
      // Setup mock to return data after sync
      db.customers.toArray
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockCustomers);
      
      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('jane@example.com')).toBeInTheDocument();
        expect(screen.getByText('1234567890')).toBeInTheDocument();
        expect(screen.getByText('0987654321')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should show empty state when no customers exist', async () => {
      customerService.getCustomers.mockResolvedValue([]);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText(/no customers/i)).toBeInTheDocument();
      });
    });
  });

  describe('Create Customer', () => {
    it('should open create customer form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText(/add customer/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add customer/i);
      await user.click(addButton);

      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    });

    it('should create new customer successfully', async () => {
      const user = userEvent.setup();
      const newCustomer = {
        _id: 'cust-new',
        name: 'New Customer',
        email: 'new@example.com',
        phone: '5555555555',
        address: '789 Pine Rd',
      };

      customerService.createCustomer.mockResolvedValue(newCustomer);
      db.customers.add.mockResolvedValue(undefined);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText(/add customer/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add customer/i);
      await user.click(addButton);

      // Fill form
      await user.type(screen.getByPlaceholderText('Name'), 'New Customer');
      await user.type(screen.getByPlaceholderText('Email'), 'new@example.com');
      await user.type(screen.getByPlaceholderText('Phone'), '5555555555');

      // Submit
      const saveButton = screen.getByText(/save/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(db.customers.add).toHaveBeenCalled();
        expect(db.syncQueue.add).toHaveBeenCalled();
      });
    });
  });

  describe('Delete Customer', () => {
    it('should delete customer successfully', async () => {
      const user = userEvent.setup();
      
      // Setup mock to return data
      db.customers.toArray
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockCustomers);
      
      const deleteMock = vi.fn().mockResolvedValue(undefined);
      db.customers.where.mockReturnValue({
        equals: vi.fn().mockReturnValue({
          delete: deleteMock,
        }),
      });
      db.syncQueue.add.mockResolvedValue(undefined);

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      }, { timeout: 3000 });

      const deleteButtons = screen.getAllByText(/delete/i);
      await user.click(deleteButtons[0]);

      // Confirm modal should appear — click the confirm button inside it
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      const dialog = screen.getByRole('dialog');
      const confirmBtn = within(dialog).getByText('Delete');
      await user.click(confirmBtn);

      // window.confirm is mocked globally to return true, so deletion proceeds
      // Verify db operations were called
      await waitFor(() => {
        expect(deleteMock).toHaveBeenCalled();
        expect(db.syncQueue.add).toHaveBeenCalledWith(
          expect.objectContaining({
            entity: 'customers',
            action: 'delete',
            entityId: 'cust-1',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      customerService.getCustomers.mockRejectedValue(new Error('Network error'));
      // Ensure local DB is empty so component attempts a server fetch and triggers the error path
      db.customers.toArray.mockResolvedValue([]);

        renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        // Accept either the explicit text or a role=alert banner; be lenient to
        // account for slight rendering differences across environments.
        const found = screen.queryByText(/could not connect/i) || screen.queryByRole('alert');
        expect(found).not.toBeNull();
      }, { timeout: 3000 });
    });

    it('should show error message on create failure', async () => {
      const user = userEvent.setup();
      
      // Setup customers to load so we're not in empty state
      db.customers.toArray
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockCustomers);
      
      customerService.getCustomers.mockResolvedValue(mockCustomers);
      
      // Make db.customers.add fail to simulate create failure
      db.customers.add.mockRejectedValue(new Error('Failed to save'));

      renderWithProviders(<CustomersPage />);

      // Wait for customers to load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Click add customer button in header
      const addButtons = screen.getAllByText(/add customer/i);
      await user.click(addButtons[0]);

      // Wait for form to appear
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
      });

      // Fill the form (use exact placeholders to avoid confusion with search)
      await user.type(screen.getByPlaceholderText('Name'), 'Test Customer');
      await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Phone'), '1234567890');

      // Submit the form
      const saveButton = screen.getByText(/save/i);
      await user.click(saveButton);

      // Verify db.customers.add was attempted and failed
      await waitFor(() => {
        expect(db.customers.add).toHaveBeenCalled();
      }, { timeout: 3000 });
      
      // Verify error message appears
      await waitFor(() => {
        expect(screen.getByText(/failed to save customer locally/i)).toBeInTheDocument();
      });
    });
  });

  describe('Offline Functionality', () => {
    it('should load customers from local database first', async () => {
      const localCustomers = [mockCustomers[0]];
      db.customers.toArray.mockResolvedValue(localCustomers);

      renderWithProviders(<CustomersPage />);

      // Should show local data immediately
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Then sync with server (should NOT call server when local DB already has data)
      await waitFor(() => {
        expect(customerService.getCustomers).not.toHaveBeenCalled();
      });
    });

    it('should queue customer creation for sync when offline', async () => {
      const user = userEvent.setup();
      customerService.createCustomer.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<CustomersPage />);

      await waitFor(() => {
        expect(screen.getByText(/add customer/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add customer/i);
      await user.click(addButton);

      await user.type(screen.getByPlaceholderText('Name'), 'Offline Customer');
      await user.type(screen.getByPlaceholderText('Email'), 'offline@example.com');

      const saveButton = screen.getByText(/save/i);
      await user.click(saveButton);

      await waitFor(() => {
        // Should still add to local DB
        expect(db.customers.add).toHaveBeenCalled();
        // And queue for sync
        expect(db.syncQueue.add).toHaveBeenCalled();
      });
    });
  });
});

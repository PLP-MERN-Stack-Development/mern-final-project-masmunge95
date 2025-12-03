/// <reference types="cypress" />

describe('Invoices Page E2E Tests', () => {
  beforeEach(() => {
    // Clear local storage, login, and set the user role
    cy.clearIndexedDB();
    cy.login();
    cy.setRole('seller');

    // Visit the invoices page directly after login/role selection to avoid
    // landing-page differences (some environments redirect to RecordsPage).
    cy.visit('/invoices', { timeout: 30000 });
    cy.waitForNetworkIdle(2000);
    // Do not assert page header here; individual suites will control
    // navigation/mocks to avoid brittle landing differences.
  });

  afterEach(() => {
    cy.logout();
  });

  describe('Page Display', () => {
    beforeEach(() => {
      // Mock the API to return no invoices BEFORE the page loads
      cy.mockApi('GET', '**/api/invoices*', { invoices: [] });
      // Re-visit the page with the mock in place
      cy.visit('/invoices');
      cy.waitForNetworkIdle();
    });

    it('should display invoice page header and empty state', () => {
      // Check header
      cy.contains('h1', /invoice management/i).should('be.visible');
      cy.contains(/create, track, and manage your invoices/i).should('be.visible');

      // Check "Create Invoice" button exists
      cy.contains('button', /create( your first)? invoice/i).should('be.visible');

      // Check empty state text
      cy.contains(/No Invoices Yet/i).should('be.visible');
      cy.contains(/Create your first invoice to start tracking payments and managing customer billing/i).should('be.visible');
    });
  });

  describe('Create Invoice', () => {
    it('should open invoice creation form', () => {
      cy.contains('button', /create( your first)? invoice/i).click();

      // Form should be visible
      cy.contains(/add new invoice/i).should('be.visible');
      // The customerId select is a key field in the form
      cy.get('select').should('be.visible');
    });

    it('should show validation errors if the form is submitted empty', () => {
      cy.contains('button', /create( your first)? invoice/i).click();

      // Try to submit empty form by clicking the save button inside the form
      cy.get('form').within(() => {
        cy.contains('button', /save invoice/i).click();
      });

      // The form should remain visible, and we check for an invalid required field, like the customer select.
      cy.get('select[required]:invalid').should('be.visible');
    });

    it('should cancel invoice creation', () => {
      cy.contains('button', /create( your first)? invoice/i).click();

      // Form is visible
      cy.contains(/add new invoice/i).should('be.visible');

      // Click cancel
      cy.contains('button', /cancel/i).click();

      // Should return to the main invoice list view
      cy.contains(/add new invoice/i).should('not.exist');
      cy.contains('h1', /invoice management/i).should('be.visible');
    });
  });

  describe('Print and Export', () => {
    it('should show print and export buttons when invoices exist', () => {
      // Mock the API to return a single invoice
      const mockInvoices = {
        invoices: [
          {
            _id: 'test-inv-1',
            invoiceNumber: 'INV-TEST-001',
            customerId: 'cust-123',
            customerName: 'Test Customer',
            total: 1500,
            status: 'draft',
            createdAt: new Date().toISOString(),
            dueDate: new Date().toISOString(),
          },
        ],
      };
      cy.mockApi('GET', '**/api/invoices*', mockInvoices);

      // Seed the local Dexie DB so the local-first UI will render the buttons
      cy.window().then((win) => {
        return new Cypress.Promise((resolve) => {
          (async () => {
            try {
              // Use the application's `db` instance attached to window (if present)
              const db = win.db || (win.__APP__ && win.__APP__.db) || null;
              if (db && db.invoices && typeof db.invoices.bulkAdd === 'function') {
                // Clear existing and populate with mock invoices
                await db.invoices.clear();
                await db.invoices.bulkAdd(mockInvoices.invoices.map(inv => ({ ...inv })));
              } else {
                // Fallback: try calling a client helper if available
                if (win.__seedIndexedDB) await win.__seedIndexedDB('invoices', mockInvoices.invoices);
              }
            } catch (e) {
              // If seeding fails, log but continue — the test will fail visibly.
              // We prefer explicit failures in assertions rather than hard errors here.
              // eslint-disable-next-line no-console
              console.warn('Failed to seed local DB for invoices spec', e);
            }
            resolve();
          })();
        });
      });

      // Re-visit the page to load the mocked/local data
      cy.visit('/invoices');
      cy.waitForNetworkIdle();

      // Wait for the invoice to appear in the UI before checking for buttons
      cy.contains('INV-TEST-001', { timeout: 10000 }).should('be.visible');
      cy.contains('Test Customer', { timeout: 5000 }).should('be.visible');
      
      // Verify the Create Invoice button is present (confirming showAddForm is false)
      cy.contains('button', /create invoice/i).should('be.visible');
      
      // Buttons should now be visible because there's at least one invoice
      // These buttons only appear when: !showAddForm && invoices.length > 0
      cy.contains('button', /print/i, { timeout: 10000 }).should('be.visible');
      cy.contains('button', /export csv/i, { timeout: 5000 }).should('be.visible');
    });
  });
});

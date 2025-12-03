/// <reference types="cypress" />

describe('Utility Services E2E Tests', () => {
  beforeEach(() => {
    // Login and set role before each test to ensure clean state
    cy.login();
    cy.setRole('seller');
  });

  afterEach(() => {
    cy.logout();
  });

  describe('View Services', () => {
    it('should display the utility services page and empty state', () => {
      // Mock the initial API call to ensure a clean state
      cy.mockApi('GET', '**/api/services*', []);
      
      // Visit the page
      cy.visit('/services');
      cy.waitForNetworkIdle();
      
      // Wait for the page header to ensure it's loaded
      cy.contains('h1', /utility services/i, { timeout: 10000 }).should('be.visible');
      
      cy.contains(/Manage your service offerings, pricing, and fees in one place/i).should('be.visible');
      cy.contains('button', /add new service/i).should('be.visible');
      cy.contains(/no services yet/i).should('be.visible');
    });

    it('should display a list of services when data exists', () => {
      const mockServices = [
        { _id: 'service-1', name: 'Water', unitPrice: 50, fees: [], total: 50 },
        { _id: 'service-2', name: 'Electricity', unitPrice: 100, fees: [], total: 100 },
      ];
      cy.mockApi('GET', '**/api/services*', mockServices);
      cy.visit('/services');
      cy.waitForNetworkIdle();
      cy.wait(1000); // Give time for local DB sync

      cy.contains('Water', { timeout: 10000 }).should('be.visible');
      cy.contains('Electricity').should('be.visible');
      cy.contains(/ksh 50/i).should('be.visible');
      cy.contains(/ksh 100/i).should('be.visible');
    });
  });

  describe('Create Service', () => {
    it('should open the service creation modal', () => {
      cy.mockApi('GET', '**/api/services*', []);
      cy.visit('/services');
      cy.waitForNetworkIdle();
      cy.contains('h1', /utility services/i, { timeout: 10000 }).should('be.visible');
      
      cy.contains('button', /add new service/i).click();
      cy.contains('h2', /add new service/i).should('be.visible');
      cy.get('input#service-name').should('be.visible');
      cy.contains('button', 'Save Service').should('be.visible');
    });

    it('should show validation error for empty service name', () => {
      cy.mockApi('GET', '**/api/services*', []);
      cy.visit('/services');
      cy.waitForNetworkIdle();
      cy.contains('h1', /utility services/i, { timeout: 10000 }).should('be.visible');
      

    it('should create a new service successfully', () => {
      cy.mockApi('POST', '**/api/services', { _id: 'new-service', name: 'Internet', unitPrice: 80, total: 180 });
      cy.mockApi('GET', '**/api/services*', [{ _id: 'new-service', name: 'Internet', unitPrice: 80, fees: [{ description: 'Installation', amount: 100 }], total: 180 }]);
      
      cy.visit('/services');
      cy.waitForNetworkIdle();
      cy.contains('h1', /utility services/i, { timeout: 10000 }).should('be.visible');
      
      cy.contains('button', /add new service/i).click();
    it('should create a new service successfully', () => {
      cy.mockApi('POST', '**/api/services', { _id: 'new-service', name: 'Internet', unitPrice: 80, total: 180 });
      cy.mockApi('GET', '**/api/services*', [{ _id: 'new-service', name: 'Internet', unitPrice: 80, fees: [{ description: 'Installation', amount: 100 }], total: 180 }]);
      
      cy.contains('button', /add new service/i).click();
      
      cy.get('input#service-name').type('Internet');
      cy.get('input#service-price').clear().type('80');
      cy.contains('button', 'Add Fee').click();
      cy.get('input[placeholder="Fee Description"]').type('Installation');
      cy.get('input[placeholder="Amount (KSH)"]').type('100');
      
      cy.contains('button', 'Save Service').click();
      cy.waitForNetworkIdle();
      cy.wait(1000); // Give time for DB update
      
      cy.contains('Internet', { timeout: 10000 }).should('be.visible');
  describe('Edit Service', () => {
    it('should open the edit modal with pre-filled data', () => {
      const mockService = {
        _id: 'service-1',
        name: 'Water',
        details: 'Water utility service',
        unitPrice: 50,
        fees: [{ description: 'Service Fee', amount: 5 }],
        total: 55,
      };
      cy.mockApi('GET', '**/api/services*', [mockService]);
      cy.visit('/services');
      cy.waitForNetworkIdle();
      cy.wait(1000); // Wait for DB sync
      // Wait for the service to appear before proceeding
      cy.contains('Water', { timeout: 10000 }).should('be.visible');
      
      cy.contains('Water').parents('[class*="p-6"]').contains('button', 'Edit').click();
    });

    it('should open the edit modal with pre-filled data', () => {
      cy.contains('Water').parents('[class*="p-6"]').contains('button', 'Edit').click();
      
      cy.contains('h2', /edit service/i).should('be.visible');
      cy.get('input#service-name').should('have.value', 'Water');
      cy.get('textarea#service-details').should('have.value', 'Water utility service');
      cy.get('input#service-price').should('have.value', '50');

    it('should update a service successfully', () => {
      const mockService = {
        _id: 'service-1',
        name: 'Water',
        details: 'Water utility service',
        unitPrice: 50,
        fees: [{ description: 'Service Fee', amount: 5 }],
        total: 55,
      };
      cy.mockApi('GET', '**/api/services*', [mockService]);
      cy.mockApi('PUT', '**/api/services/service-1', { message: 'Update successful' });
      cy.mockApi('GET', '**/api/services*', [{ _id: 'service-1', name: 'Updated Water', unitPrice: 65, fees: [], total: 65 }]);

      cy.visit('/services');
      cy.waitForNetworkIdle();
      cy.wait(1000);
      cy.contains('Water', { timeout: 10000 }).should('be.visible');
      
      cy.contains('Water').parents('[class*="p-6"]').contains('button', 'Edit').click();
      
      cy.get('input#service-name').clear().type('Updated Water');
      cy.get('input#service-price').clear().type('65');
      
      cy.contains('button', 'Update Service').click();
      cy.waitForNetworkIdle();
      cy.wait(1000); // Wait for DB update
      
      cy.contains('Updated Water', { timeout: 10000 }).should('be.visible');
      cy.contains(/ksh 65/i, { timeout: 5000 }).should('be.visible');
      cy.contains('Water').should('not.exist');
    });
  });

  describe('Delete Service', () => {
    it('should delete a service after confirmation', () => {
      const mockService = { _id: 'service-1', name: 'Service To Delete', unitPrice: 10, fees: [], total: 10 };
      // Mock the initial state with one service
      cy.mockApi('GET', '**/api/services*', [mockService]);
      // Mock the DELETE request that will be sent to the sync queue
      cy.mockApi('DELETE', '**/api/services/service-1', { message: 'Service deleted' });
      
      cy.visit('/services');
      cy.waitForNetworkIdle();
      cy.wait(1000); // Wait for DB sync

      // Ensure the service is visible initially
      cy.contains('Service To Delete', { timeout: 10000 }).should('be.visible');

      // Click the delete button and handle the confirmation
      cy.on('window:confirm', () => true);
      cy.contains('Service To Delete').parents('[class*="p-6"]').contains('button', 'Delete').click();
      
      cy.wait(500); // Wait for optimistic UI update
      
      // After deletion, the item should be removed from the UI optimistically
      cy.contains('Service To Delete').should('not.exist');
      
      // The empty state should now be visible
      cy.contains(/no services yet/i, { timeout: 5000 }).should('be.visible');
    });
  });
      // To properly test, you would first visit the page with a successful API call
      // to populate the cache, then simulate an offline scenario.
    });
  });
});
      // Since the cache is empty, we expect the empty state, not an error banner.
      cy.contains(/no services yet/i).should('be.visible');

      // To properly test, you would first visit the page with a successful API call
      // to populate the cache, then simulate an offline scenario.
    });
  });
  
  after(() => {
    cy.logout();
  });
});

// ***********************************************************
// This file is processed and loaded automatically before test files.
// This is a great place to put global configuration and behavior.
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Prevent Cypress from failing tests on uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false prevents Cypress from failing the test
  // Customize this based on your needs
  console.error('Uncaught exception:', err);
  return false;
});

// Add custom commands for authentication using real Clerk test user
Cypress.Commands.add('login', () => {
  const email = Cypress.env('TEST_USER_EMAIL');
  const password = Cypress.env('TEST_USER_PASSWORD');
    const verificationCode = Cypress.env('TEST_USER_VERIFICATION_CODE') || '424242';

  // Visit the app
  cy.visit('/');
  
  // Wait for page to load
  cy.wait(2000);

  // Check if already logged in by looking for seller/customer dashboard links
  cy.get('body').then(($body) => {
    const bodyText = $body.text();
    
    // If we see Dashboard, Records, Invoices in nav, user is logged in
    if (bodyText.includes('Dashboard') && 
        (bodyText.includes('Records') || bodyText.includes('My Dashboard'))) {
      cy.log('User already authenticated');
      return;
    }

    // Not logged in, click "Sign in" link on landing page
    cy.contains('button', /sign in/i).should('be.visible').click();
    
    // Wait for Clerk sign-in component to appear
      // Fill in Clerk's sign-in form
      cy.get('input[name="identifier"]').should('be.visible').type(email);
      cy.contains('button', /continue/i).click();

      // Wait for password field
      cy.get('input[name="password"]', { timeout: 10000 }).should('be.visible').type(password);
      cy.contains('button', /continue/i).click();

      // The test user requires 2FA, so we now explicitly wait for and fill in the OTP code.
      cy.log('Waiting for OTP input to enter verification code.');

      // Wait for the OTP input field to become visible, then type the code.
      cy.get('input[data-input-otp="true"]', { timeout: 15000 })
        .should('be.visible')
        .type(verificationCode);

      // Click the final submission button, which could be 'Continue' or 'Verify'.
      cy.contains(/continue|verify/i).should('be.visible').click();

      // Wait for authentication to complete and redirect
      cy.wait(4000);
    });
});

// Set user role (seller or customer)
Cypress.Commands.add('setRole', (role) => {
  // Visit role selection page (handles case where no role or different role)
  cy.visit('/select-role', { timeout: 30000 });
  cy.wait(3000);
  
  // Check if we're already on the dashboard (role already set)
  cy.url().then((url) => {
    if (url.includes('/records') || url.includes('/dashboard')) {
      cy.log(`Already on dashboard - role likely already set to ${role}`);
      return;
    }
    
    // We're on role selection page - click the appropriate role button
    // Only click if the expected button text is actually present in the page.
    cy.get('body').then(($body) => {
      const fullText = $body.text().toLowerCase();

      if (role === 'seller') {
        if (fullText.includes("i'm a seller") || fullText.includes("i'm a Seller")) {
          cy.contains('button', /i'm a seller/i, { timeout: 10000 }).should('be.visible').click();
          cy.wait(5000);
          cy.log(`Role set to ${role}`);
        } else {
          cy.log("Seller button not present; assuming role already selected or different UI.");
        }
      } else {
        if (fullText.includes("i'm a customer") || fullText.includes("i'm a Customer")) {
          cy.contains('button', /i'm a customer/i, { timeout: 10000 }).should('be.visible').click();
          cy.wait(5000);
          cy.log(`Role set to ${role}`);
        } else {
          cy.log("Customer button not present; assuming role already selected or different UI.");
        }
      }
    });
  });
});

Cypress.Commands.add('logout', () => {
  cy.window().then(async (win) => {
    if (win.Clerk?.user) {
      try {
        await win.Clerk.signOut();
      } catch (error) {
        console.log('Logout error:', error);
      }
    }
    win.localStorage.clear();
    win.sessionStorage.clear();
  });
});

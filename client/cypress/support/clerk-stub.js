// Stub Clerk for Cypress E2E testing
Cypress.Commands.add('stubClerk', () => {
  cy.window().then((win) => {
    // Create mock Clerk object
    win.Clerk = {
      loaded: true,
      session: {
        id: 'sess_cypress_123',
        user: {
          id: 'user_cypress_123',
          emailAddress: 'test@cypress.io',
          firstName: 'Cypress',
          lastName: 'Test',
        },
      },
      user: {
        id: 'user_cypress_123',
        emailAddress: 'test@cypress.io',
        firstName: 'Cypress',
        lastName: 'Test',
      },
    };

    // Mock @clerk/clerk-react hooks
    const mockSession = {
      id: 'sess_cypress_123',
      user: {
        id: 'user_cypress_123',
        emailAddresses: [{ emailAddress: 'test@cypress.io' }],
        firstName: 'Cypress',
        lastName: 'Test',
      },
      status: 'active',
      lastActiveAt: new Date(),
      expireAt: new Date(Date.now() + 86400000),
    };

    // Store mocked Clerk data
    win.__CLERK_STUB__ = {
      isLoaded: true,
      isSignedIn: true,
      session: mockSession,
      user: mockSession.user,
    };
  });
});

// Intercept Clerk frontend API calls
Cypress.Commands.add('interceptClerkAPI', () => {
  cy.intercept('GET', '**/v1/client*', (req) => {
    req.reply({
      statusCode: 200,
      body: {
        response: {
          sessions: [{
            id: 'sess_cypress_123',
            user: {
              id: 'user_cypress_123',
              primary_email_address_id: 'email_123',
              email_addresses: [
                { 
                  id: 'email_123', 
                  email_address: 'test@cypress.io' 
                }
              ],
              first_name: 'Cypress',
              last_name: 'Test',
            },
            status: 'active',
            last_active_at: Date.now(),
            expire_at: Date.now() + 86400000,
          }],
          client: {
            sessions: [{
              id: 'sess_cypress_123',
              status: 'active',
            }],
            last_active_session_id: 'sess_cypress_123',
            sign_in: null,
            sign_up: null,
          },
        },
      },
    });
  }).as('clerkAPI');

  // Intercept session endpoint
  cy.intercept('GET', '**/v1/sessions/**', {
    statusCode: 200,
    body: {
      response: {
        id: 'sess_cypress_123',
        status: 'active',
        user_id: 'user_cypress_123',
        last_active_at: Date.now(),
        expire_at: Date.now() + 86400000,
      },
    },
  }).as('clerkSession');
});

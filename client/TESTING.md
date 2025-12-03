# Frontend Testing Guide

## Overview

This project uses **Vitest** for unit/component testing and **Cypress** for end-to-end (E2E) testing. Both are configured to run sequentially (`--runInBand` equivalent) to prevent resource contention and ensure reliable test execution.

## Test Structure

```
client/
├── src/
│   ├── components/
│   │   ├── ServiceForm.jsx
│   │   └── ServiceForm.test.jsx          # Component tests
│   ├── services/
│   │   ├── utilityService.js
│   │   └── utilityService.test.js        # Unit tests
│   └── tests/
│       ├── setup.js                      # Vitest global setup
│       ├── unit/                         # Unit tests
│       └── integration/                  # Integration tests
├── cypress/
│   ├── e2e/
│   │   └── utilityServices.cy.js        # E2E tests
│   └── support/
│       ├── commands.js                   # Custom Cypress commands
│       └── e2e.js                        # Cypress setup
└── vitest.config.js                      # Vitest configuration
```

## Running Tests

### Vitest (Unit/Component Tests)

```bash
# Run all unit/component tests once
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with UI (interactive)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Cypress (E2E Tests)

```bash
# Open Cypress interactive test runner
npm run cypress

# Run E2E tests headless (CI mode)
npm run cypress:headless

# Alias for headless E2E tests
npm run test:e2e

# Open E2E tests in interactive mode
npm run test:e2e:open
```

## Test Configuration

### Vitest Configuration

**Key Settings** (`vitest.config.js`):
- **Environment**: `jsdom` (simulates browser DOM)
- **Global Setup**: Mocks Clerk auth, IndexedDB, crypto.randomUUID
- **Coverage**: v8 provider with text/json/html reports
- **Sequential Execution**: `pool: 'forks'` with `singleFork: true` (equivalent to Jest's `--runInBand`)
- **Timeout**: 60 seconds per test

### Cypress Configuration

**Key Settings** (`cypress.config.js`):
- **Base URL**: `http://localhost:5173` (Vite dev server)
- **Video Recording**: Disabled (save disk space)
- **Screenshots**: Enabled on failures only
- **Sequential Execution**: Tests run one at a time by default

## Writing Tests

### Unit Tests (Vitest)

Example: Testing a service function

```javascript
import { describe, it, expect, vi } from 'vitest';
import { getUtilityServices } from './utilityService';
import api from './api';

vi.mock('./api');

describe('getUtilityServices', () => {
  it('should fetch services with search query', async () => {
    api.get.mockResolvedValue({ data: [{ name: 'Water' }] });
    
    const result = await getUtilityServices('Water');
    
    expect(api.get).toHaveBeenCalledWith('/services', { params: { search: 'Water' } });
    expect(result).toEqual([{ name: 'Water' }]);
  });
});
```

### Component Tests (React Testing Library + Vitest)

Example: Testing a React component

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiceForm from './ServiceForm';

describe('ServiceForm', () => {
  it('should submit form with correct data', async () => {
    const user = userEvent.setup();
    const mockOnSave = vi.fn();
    
    render(<ServiceForm onSave={mockOnSave} onCancel={() => {}} />);
    
    await user.type(screen.getByLabelText(/service name/i), 'Water');
    await user.click(screen.getByText(/save/i));
    
    expect(mockOnSave).toHaveBeenCalledWith({
      name: 'Water',
      // ... other fields
    });
  });
});
```

### E2E Tests (Cypress)

Example: Testing a complete user workflow

```javascript
describe('Utility Services E2E', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/utility-services');
  });

  it('should create a new service', () => {
    cy.contains('button', /add service/i).click();
    cy.get('input[name="name"]').type('Water');
    cy.get('input[name="unitPrice"]').type('50');
    cy.contains('button', /save/i).click();
    
    cy.contains('Water').should('be.visible');
  });
});
```

## Custom Cypress Commands

### Authentication

```javascript
// Login with test credentials
cy.login();

// Logout
cy.logout();
```

### API Mocking

```javascript
// Mock an API endpoint
cy.mockApi('GET', '**/api/services', [{ name: 'Water' }]);
```

### Database Cleanup

```javascript
// Clear IndexedDB
cy.clearIndexedDB();

// Wait for network requests to complete
cy.waitForNetworkIdle();
```

## Test Coverage

### Current Coverage (Frontend)

Run `npm run test:coverage` to generate a coverage report.

**Target Coverage Goals**:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

### Viewing Coverage Reports

After running `npm run test:coverage`:
1. Open `coverage/index.html` in a browser
2. Or view the text summary in the terminal

## Mocked Dependencies

### Global Mocks (in `src/tests/setup.js`)

1. **Clerk Authentication**
   - `useAuth()` returns test user with ID `test-user-123`
   - `useUser()` returns test user object
   - All Clerk components return `null` (no UI rendering)

2. **IndexedDB**
   - Basic mock for Dexie operations
   - Tests don't actually persist data to browser storage

3. **crypto.randomUUID()**
   - Returns deterministic UUID: `12345678-1234-1234-1234-123456789012`

4. **window.matchMedia**
   - Always returns `matches: false`
   - Prevents errors in components using media queries

## Best Practices

### 1. Test Organization

- **Unit tests**: Test individual functions in isolation
- **Component tests**: Test component behavior with user interactions
- **E2E tests**: Test complete user workflows across multiple pages

### 2. Test Isolation

- Each test should be independent
- Use `beforeEach` to reset state
- Clear mocks with `vi.clearAllMocks()`

### 3. Assertions

- Use descriptive assertions: `expect(button).toBeInTheDocument()`
- Test user-visible behavior, not implementation details
- Avoid testing internal state

### 4. Async Testing

```javascript
// Wait for async operations
await waitFor(() => {
  expect(mockFn).toHaveBeenCalled();
});

// User interactions are async
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
```

### 5. E2E Testing

- Start dev server before running E2E tests: `npm run dev`
- Use `cy.intercept()` to mock API responses
- Test happy paths and error states
- Keep E2E tests focused on critical user journeys

## Troubleshooting

### Tests Timing Out

If tests timeout, check:
1. Are async operations awaited?
2. Is the timeout sufficient? (increase in config)
3. Are there network requests that need mocking?

### Mock Not Working

If mocks aren't applying:
1. Ensure `vi.mock()` is called before imports
2. Check mock path matches actual import path
3. Verify mock functions are cleared between tests

### Clerk Auth Errors

If Clerk throws errors in tests:
1. Check `src/tests/setup.js` is loaded
2. Verify components use `useAuth()` hook correctly
3. Ensure `ClerkProvider` is mocked

### IndexedDB Errors

If Dexie throws errors:
1. Use `cy.clearIndexedDB()` in Cypress tests
2. Mock Dexie operations in unit tests
3. Test with mocked data, not actual DB

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Frontend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        working-directory: ./client
      
      - name: Run unit tests
        run: npm test
        working-directory: ./client
      
      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: ./client
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Cypress Documentation](https://docs.cypress.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library User Events](https://testing-library.com/docs/user-event/intro/)

/**
 * Global E2E support file.
 * Loaded automatically before every E2E spec file.
 *
 * - Imports custom commands
 * - Sets viewport size (1280x720)
 * - Intercepts WMTS tile requests to avoid network noise during tests
 */

import './commands'

beforeEach(() => {
  // Set a consistent viewport size for all tests
  cy.viewport(1280, 720)

  // Intercept WMTS tile requests to prevent network calls to external tile servers.
  // This avoids flaky tests due to tile-loading timeouts and speeds up test execution.
  cy.intercept('GET', '**/wmts/**', { statusCode: 200, body: '' }).as('tileRequest')
})

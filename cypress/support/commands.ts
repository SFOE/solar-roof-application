/**
 * Custom Cypress commands for the Sonnendach E2E test suite.
 * These commands encapsulate common test patterns for reuse across specs.
 */

import {
  setupSearchIntercept,
  setupIdentifyIntercept,
  setupFindIntercept,
  setupVeseIntercept,
} from './intercepts'

// --- TypeScript declarations for custom commands ---
declare global {
  // Cypress documents this namespace as the way to add custom commands to its types.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Intercept all geo.admin.ch API calls (search, identify, find) with fixtures.
       * @param fixture - optional fixture file override for identify responses
       */
      interceptGeoAdmin(fixture?: string): Chainable<void>

      /**
       * Intercept VESE pvtarif API calls with fixtures.
       * @param options.error - if true, simulates a 503 error response
       */
      interceptVese(options?: { error?: boolean }): Chainable<void>

      /**
       * Simulate an address search and selection.
       * Types the address into the search bar and clicks the first suggestion.
       * @param address - the text to type in the search input
       */
      searchAndSelect(address: string): Chainable<void>

      /**
       * Click on the map at given pixel coordinates relative to the map canvas.
       * @param x - horizontal pixel offset from left
       * @param y - vertical pixel offset from top
       */
      clickMap(x: number, y: number): Chainable<void>
    }
  }
}

// --- Command implementations ---

Cypress.Commands.add('interceptGeoAdmin', (fixture?: string) => {
  setupSearchIntercept()
  setupIdentifyIntercept(fixture)
  setupFindIntercept(fixture)
})

Cypress.Commands.add('interceptVese', (options?: { error?: boolean }) => {
  setupVeseIntercept(options)
})

Cypress.Commands.add('searchAndSelect', (address: string) => {
  cy.get('input.search-input').clear()
  cy.get('input.search-input').type(address)

  // Wait for the search request to complete and select the first result
  cy.wait('@searchRequest')
  cy.get('.search-results li, .suggestions li, .autocomplete-results li')
    .first()
    .click()
})

Cypress.Commands.add('clickMap', (x: number, y: number) => {
  cy.get('.map-wrapper canvas, .map-container canvas, .ol-viewport canvas')
    .first()
    .click(x, y, { force: true })
})

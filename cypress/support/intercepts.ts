/**
 * Centralized intercept helpers for Cypress E2E tests.
 * Each function wraps cy.intercept() patterns for a specific API endpoint,
 * replacing real network calls with local fixture data.
 */

/**
 * Intercepts swisstopo SearchServer requests.
 * @param fixture - fixture file path (default: 'search-results.json')
 */
export function setupSearchIntercept(fixture = 'search-results.json'): void {
  cy.intercept('GET', 'https://api3.geo.admin.ch/rest/services/api/SearchServer*', {
    fixture,
  }).as('searchRequest')
}

/**
 * Intercepts geo.admin.ch identify requests (used for building identification on map click).
 * @param fixture - fixture file path (default: 'identify-roofs.json')
 */
export function setupIdentifyIntercept(fixture = 'identify-roofs.json'): void {
  cy.intercept('GET', 'https://api3.geo.admin.ch/rest/services/api/MapServer/identify*', {
    fixture,
  }).as('identifyRequest')
}

/**
 * Intercepts geo.admin.ch find requests (building surfaces and GWR lookup).
 * @param fixture - fixture file path (default: 'identify-roofs.json')
 */
export function setupFindIntercept(fixture = 'identify-roofs.json'): void {
  cy.intercept('GET', 'https://api3.geo.admin.ch/rest/services/api/MapServer/find*', {
    fixture,
  }).as('findRequest')
}

/**
 * Intercepts VESE pvtarif API requests (municipality and EVU tariff lookups).
 * In production build, calls go to the Lambda proxy URL (execute-api.amazonaws.com).
 * In dev, calls go to /api/pvtarif/*.
 * We intercept both patterns to cover all environments.
 * @param options.error - if true, returns a 503 error instead of fixture data
 * @param options.muniFixture - fixture for /muni endpoint (default: 'vese-muni.json')
 * @param options.evuFixture - fixture for /evu endpoint (default: 'vese-evu.json')
 */
export function setupVeseIntercept(
  options: { error?: boolean; muniFixture?: string; evuFixture?: string } = {},
): void {
  const { error = false, muniFixture = 'vese-muni.json', evuFixture = 'vese-evu.json' } = options

  // Match both dev (/api/pvtarif/muni) and prod (Lambda URL /muni) patterns.
  if (error) {
    cy.intercept('GET', /\/muni\?/, { statusCode: 503, body: {} }).as('veseMuniRequest')
    cy.intercept('GET', /\/evu\?/, { statusCode: 503, body: {} }).as('veseEvuRequest')
  } else {
    cy.intercept('GET', /\/muni\?/, { fixture: muniFixture }).as('veseMuniRequest')
    cy.intercept('GET', /\/evu\?/, { fixture: evuFixture }).as('veseEvuRequest')
  }
}

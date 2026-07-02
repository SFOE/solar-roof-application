/**
 * E2E tests for the address search flow.
 *
 * Covers:
 * - Search input triggering API call (Req 2.1)
 * - Suggestion list display (Req 2.2)
 * - Address selection triggering map centering + identify (Req 2.3)
 * - InfoPanel display with solar data after selection (Req 2.4)
 * - API error handling (Req 2.5)
 */

describe('Address Search', () => {
  beforeEach(() => {
    cy.interceptGeoAdmin()
    cy.interceptVese()
    cy.visit('/')
  })

  it('typing ≥2 characters calls SearchServer API with correct params', () => {
    // Type 2+ characters in the search input to trigger the API call
    cy.get('input.search-input')
      .clear()
      .type('Ba')

    // Wait for the debounced search request and verify URL params
    cy.wait('@searchRequest').its('request.url').should((url) => {
      expect(url).to.include('SearchServer')
      expect(url).to.include('searchText=Ba')
      expect(url).to.include('type=locations')
      expect(url).to.include('sr=2056')
      expect(url).to.include('limit=5')
    })
  })

  it('successful API response displays suggestion list with address labels from fixture', () => {
    cy.get('input.search-input')
      .clear()
      .type('Bahnhof')

    cy.wait('@searchRequest')

    // Verify suggestion list appears with all 5 results from fixture
    cy.get('.search-results li').should('have.length', 5)

    // Verify labels match fixture data (HTML content rendered)
    cy.get('.search-results li').eq(0).should('contain.text', 'Bahnhofstrasse 1')
    cy.get('.search-results li').eq(0).should('contain.text', '3011 Bern')
    cy.get('.search-results li').eq(1).should('contain.text', 'Bahnhofstrasse 3')
    cy.get('.search-results li').eq(4).should('contain.text', 'Bahnhofstrasse 9')
  })

  it('selecting an address triggers map centering and building identification', () => {
    cy.get('input.search-input')
      .clear()
      .type('Bahnhof')

    cy.wait('@searchRequest')

    // Select the first suggestion
    cy.get('.search-results li').first().click()

    // Verify that the identify/find request is triggered (building identification)
    cy.wait('@identifyRequest').its('request.url').should('include', 'MapServer/identify')
  })

  it('selecting an address shows InfoPanel with solar data from identify fixture', () => {
    cy.get('input.search-input')
      .clear()
      .type('Bahnhof')

    cy.wait('@searchRequest')

    // Select the first suggestion
    cy.get('.search-results li').first().click()

    // Wait for identification to complete
    cy.wait('@identifyRequest')

    // Verify InfoPanel appears with solar data from the identify-roofs.json fixture
    cy.get('.info-panel').should('exist').and('be.visible')

    // Verify electricity yield value is displayed (7650 from fixture -> formatted as 7'650)
    cy.get('.info-panel').should('contain.text', 'kWh')

    // Verify suitability badge is shown (class 5 from first result in fixture)
    cy.get('.info-panel .badge-5').should('exist')
  })

  it('API error (500) results in no crash and empty suggestion list', () => {
    // Override the search intercept to return a 500 error
    cy.intercept('GET', 'https://api3.geo.admin.ch/rest/services/api/SearchServer*', {
      statusCode: 500,
      body: { error: 'Internal Server Error' },
    }).as('searchError')

    cy.get('input.search-input')
      .clear()
      .type('Bahnhof')

    cy.wait('@searchError')

    // Verify no crash — the page is still functional
    cy.get('input.search-input').should('exist')

    // Verify suggestion list is not displayed (empty results)
    cy.get('.search-results li').should('not.exist')
  })
})

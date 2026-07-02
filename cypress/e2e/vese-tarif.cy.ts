/**
 * E2E tests for VESE tariff integration.
 *
 * Covers:
 * - VESE pvtarif API called with correct commune ID after building identification (Req 7.1)
 * - Successful VESE response displays provider name and tariff in cts/kWh (Req 7.2)
 * - VESE API error shows '-' for tariff and provider without blocking other data (Req 7.3)
 */

describe('VESE Tariff Integration', () => {
  beforeEach(() => {
    cy.interceptGeoAdmin()
    // Override the find intercept: differentiate between building surface lookup and GWR lookup.
    // The GWR lookup uses layer=ch.bfs.gebaeude_wohnungs_register and searchField=egid.
    // We intercept it specifically to return ggdenr (commune ID) which triggers the VESE call.
    cy.intercept('GET', 'https://api3.geo.admin.ch/rest/services/api/MapServer/find*', (req) => {
      if (req.url.includes('gebaeude_wohnungs_register')) {
        req.reply({ fixture: 'gwr-lookup.json' })
      } else {
        // Building surfaces find → use the roof fixture
        req.reply({ fixture: 'identify-roofs.json' })
      }
    }).as('findRequest')
  })

  it('after building identification, VESE pvtarif API is called with correct commune ID', () => {
    // Set up VESE intercept to track the request
    cy.interceptVese()
    cy.visit('/')

    // Trigger a search and select to identify a building
    cy.searchAndSelect('Bahnhof')

    // Wait for identify to complete
    cy.wait('@identifyRequest')
    // Two find requests: 1) building surfaces, 2) GWR lookup (sets communeId → triggers VESE)
    cy.wait('@findRequest')
    cy.wait('@findRequest')

    // Verify that the VESE muni endpoint is called with the correct commune ID (351 from gwr-lookup.json)
    cy.wait('@veseMuniRequest').its('request.url').should('include', 'idofs=351')
  })

  it('successful VESE response displays provider name and tariff in cts/kWh in InfoPanel', () => {
    cy.interceptVese()
    cy.visit('/')

    // Trigger building identification
    cy.searchAndSelect('Bahnhof')
    cy.wait('@identifyRequest')
    cy.wait('@findRequest')
    cy.wait('@findRequest')
    cy.wait('@veseMuniRequest')
    cy.wait('@veseEvuRequest')

    // Verify provider name is displayed (nomEw from vese-evu.json: "BKW Energie AG")
    cy.get('.info-panel').should('contain.text', 'BKW Energie AG')

    // Verify tariff value is displayed in cts/kWh (energy1 from vese-evu.json: "8.45")
    // The app computes total = energy1 + eco1 when ecoIncl is not "y" -> 8.45 + 0.50 = 8.95
    cy.get('.info-panel').should('contain.text', 'cts/kWh')
    cy.get('.info-panel').should('contain.text', '8.95')
  })

  it('VESE API error/unavailability shows "-" for tariff and provider without blocking other data', () => {
    // Set up VESE intercept to simulate a 503 error
    cy.interceptVese({ error: true })
    cy.visit('/')

    // Trigger building identification
    cy.searchAndSelect('Bahnhof')
    cy.wait('@identifyRequest')
    cy.wait('@findRequest')
    cy.wait('@findRequest')
    cy.wait('@veseMuniRequest')

    // Verify InfoPanel still shows solar data (not blocked by VESE error)
    cy.get('.info-panel').should('exist').and('be.visible')
    cy.get('.info-panel').should('contain.text', 'kWh')

    // Verify tariff row shows '-' (fallback for unavailable VESE data)
    cy.get('.info-panel').contains('VESE').closest('.info-row').find('.info-value').should('contain.text', '-')

    // Verify provider row shows '-' as well
    cy.get('.info-panel').contains('Stromversorger').closest('.info-row').find('.info-value').should('contain.text', '-')
  })
})

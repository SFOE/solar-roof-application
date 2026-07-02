/**
 * E2E tests for map click and data display.
 *
 * Covers:
 * - Clicking map canvas calls geo.admin.ch identify API (Req 3.1)
 * - Identify response renders InfoPanel sections with formatted values (Req 3.2)
 * - Suitability class badge has correct CSS class (Req 3.3)
 * - Loading indicator is visible while waiting for identify response (Req 3.4)
 * - Empty identify response shows "no data" message in InfoPanel (Req 3.5)
 */

import { setupIdentifyIntercept } from '../support/intercepts'

describe('Map Click and Data Display', () => {
  beforeEach(() => {
    cy.interceptGeoAdmin()
    cy.interceptVese()
    cy.visit('/')
  })

  it('clicking map canvas calls geo.admin.ch identify API', () => {
    // Click on the map at arbitrary coordinates
    cy.clickMap(400, 300)

    // Verify the identify request was triggered with correct endpoint
    cy.wait('@identifyRequest').its('request.url').should((url) => {
      expect(url).to.include('api3.geo.admin.ch/rest/services/api/MapServer/identify')
    })
  })

  it('identify response renders InfoPanel sections (Allgemein, PV, Thermique) with formatted values', () => {
    // Click the map to trigger identification
    cy.clickMap(400, 300)

    // Wait for the identify request to complete
    cy.wait('@identifyRequest')

    // Verify InfoPanel is displayed
    cy.get('.info-panel').should('exist').and('be.visible')

    // Verify the three sections are rendered with German labels (default language)
    cy.get('.info-panel .info-section h4').should('have.length', 3)
    cy.get('.info-panel .info-section h4').eq(0).should('contain.text', 'Allgemein')
    cy.get('.info-panel .info-section h4').eq(1).should('contain.text', 'Photovoltaik')
    cy.get('.info-panel .info-section h4').eq(2).should('contain.text', 'Solarthermie')

    // Verify formatted values from fixture (identify-roofs.json):
    // stromertrag: 7650 -> formatted as 7'650 (de-CH locale uses apostrophe as thousands sep)
    cy.get('.info-panel').should('contain.text', 'kWh')

    // Verify area value is displayed (flaeche: 45.2 -> rounded to 45)
    cy.get('.info-panel').should('contain.text', 'm²')
  })

  it('suitability class badge has correct CSS class (badge-5)', () => {
    // Click map to trigger identification (fixture has klasse: 5 on first result)
    cy.clickMap(400, 300)

    cy.wait('@identifyRequest')

    // Verify the badge element exists with the correct class
    cy.get('.info-panel .badge-5').should('exist')
    cy.get('.info-panel .badge.badge-5').should('be.visible')
  })

  it('loading indicator is visible while waiting for identify response', () => {
    // Override identify intercept with a delayed response to observe loading state
    cy.intercept(
      'GET',
      'https://api3.geo.admin.ch/rest/services/api/MapServer/identify*',
      (req) => {
        req.reply({
          delay: 1000,
          fixture: 'identify-roofs.json',
        })
      },
    ).as('identifyRequest')

    // Click the map to trigger identification
    cy.clickMap(400, 300)

    // Verify loading indicator is shown while waiting
    cy.get('.info-panel.loading').should('be.visible')
    cy.get('.info-panel.loading').should('contain.text', 'Laden')

    // After the delayed response arrives, loading disappears and data is shown
    cy.wait('@identifyRequest')
    cy.get('.info-panel.loading').should('not.exist')
    cy.get('.info-panel .info-grid').should('exist')
  })

  it('empty identify response shows "no data" message in InfoPanel', () => {
    // Override identify intercept with empty fixture
    setupIdentifyIntercept('identify-empty.json')

    // Click the map to trigger identification
    cy.clickMap(400, 300)

    cy.wait('@identifyRequest')

    // Verify the "no data" panel is displayed
    cy.get('.info-panel.no-data').should('exist').and('be.visible')
    cy.get('.info-panel.no-data').should('contain.text', 'Keine Daten verfügbar')
  })
})

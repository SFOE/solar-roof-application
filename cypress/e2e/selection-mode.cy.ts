/**
 * E2E tests for roof-surface selection (single cumulative mode).
 *
 * The app now has a single selection behavior: clicking a roof pane adds it
 * (cumulative multi-select); clicking it again removes it. There is no
 * building/roof mode toggle anymore.
 *
 * Covers:
 * - No selection-mode toggle is rendered
 * - Clicking the map selects a surface and shows the unified InfoPanel
 * - Summary banner appears with economic potential (CHF)
 * - "New selection" button appears when there is a selection and clears it
 */

describe('Roof surface selection (single cumulative mode)', () => {
  beforeEach(() => {
    cy.interceptGeoAdmin()
    cy.interceptVese()
    cy.visit('/')
  })

  it('No selection-mode toggle is rendered', () => {
    cy.get('.selection-toggle').should('not.exist')
  })

  it('Clicking map selects a surface and shows the InfoPanel', () => {
    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    cy.get('.info-panel').should('exist').and('be.visible')
    cy.get('.info-panel h3').should('contain.text', 'Information')
    cy.get('.info-panel').should('contain.text', 'kWh')
  })

  it('Summary banner appears with economic potential (CHF)', () => {
    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    cy.get('.summary-banner').should('be.visible')
    cy.get('.summary-banner').should('contain.text', 'CHF')
  })

  it('"New selection" button appears with a selection and clears it on click', () => {
    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    cy.get('.info-panel').should('exist').and('be.visible')
    cy.get('.clear-selection-btn').should('be.visible').and('contain.text', 'Neue Auswahl')

    cy.get('.clear-selection-btn').click()

    cy.get('.info-panel .info-grid').should('not.exist')
    cy.get('.summary-banner').should('not.exist')
  })
})

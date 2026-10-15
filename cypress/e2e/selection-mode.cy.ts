/**
 * E2E tests for the selection mode (Single / Multiple).
 *
 * - Single (default): each click replaces the selection (explore the map).
 * - Multiple: each click adds/removes a roof surface (cumulative selection).
 *
 * Covers:
 * - The selection toggle is rendered with "Einzeln" active by default
 * - Clicking the map selects a surface and shows the unified InfoPanel
 * - The summary banner appears with the economic potential (CHF)
 * - The "New selection" button only exists in Multiple mode and clears the selection
 */

describe('Selection mode (single / multiple)', () => {
  beforeEach(() => {
    cy.interceptGeoAdmin()
    cy.interceptVese()
    cy.visit('/')
  })

  it('Selection toggle is rendered with "Einzeln" active by default', () => {
    cy.get('.selection-toggle button').contains('Einzeln').should('have.class', 'active')
    cy.get('.selection-toggle button').contains('Mehrfach').should('not.have.class', 'active')
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

  it('"New selection" button is not shown in Single mode', () => {
    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    cy.get('.info-panel').should('exist').and('be.visible')
    cy.get('.clear-selection-btn').should('not.exist')
  })

  it('In Multiple mode, "New selection" button appears with a selection and clears it', () => {
    cy.get('.selection-toggle button').contains('Mehrfach').click()
    cy.get('.selection-toggle button').contains('Mehrfach').should('have.class', 'active')

    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    cy.get('.info-panel').should('exist').and('be.visible')
    cy.get('.clear-selection-btn').should('be.visible').and('contain.text', 'Neue Auswahl')

    cy.get('.clear-selection-btn').click()

    cy.get('.info-panel .info-grid').should('not.exist')
    cy.get('.summary-banner').should('not.exist')
  })
})

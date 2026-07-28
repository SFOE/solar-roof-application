/**
 * E2E tests for the selection mode toggle (Individual / Building / Multiple).
 *
 * Covers:
 * - Default mode is "Building" (Gebäude) on page load
 * - Clicking "Individual" activates it and deactivates "Building"
 * - Clicking "Multiple" activates it and deactivates others
 * - In Building mode, clicking map shows aggregated data (default behavior)
 * - In Individual mode, clicking map shows single surface data
 * - In Multiple mode, clicking map adds surfaces to selection
 * - "New selection" button appears in Multiple mode and clears selection
 */

describe('Selection Mode Toggle', () => {
  beforeEach(() => {
    cy.interceptGeoAdmin()
    cy.interceptVese()
    cy.visit('/')
  })

  it('Building mode ("Gebäude") is active by default on page load', () => {
    cy.get('.selection-toggle button').contains('Gebäude').should('have.class', 'active')
    cy.get('.selection-toggle button').contains('Einzeln').should('not.have.class', 'active')
    cy.get('.selection-toggle button').contains('Mehrfach').should('not.have.class', 'active')
  })

  it('Clicking "Einzeln" activates it and deactivates "Gebäude"', () => {
    cy.get('.selection-toggle button').contains('Einzeln').click()

    cy.get('.selection-toggle button').contains('Einzeln').should('have.class', 'active')
    cy.get('.selection-toggle button').contains('Gebäude').should('not.have.class', 'active')
    cy.get('.selection-toggle button').contains('Mehrfach').should('not.have.class', 'active')
  })

  it('Clicking "Mehrfach" activates it and deactivates others', () => {
    cy.get('.selection-toggle button').contains('Mehrfach').click()

    cy.get('.selection-toggle button').contains('Mehrfach').should('have.class', 'active')
    cy.get('.selection-toggle button').contains('Gebäude').should('not.have.class', 'active')
    cy.get('.selection-toggle button').contains('Einzeln').should('not.have.class', 'active')
  })

  it('In Building mode, clicking map shows InfoPanel with aggregated roof data', () => {
    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    cy.get('.info-panel').should('exist').and('be.visible')
    cy.get('.info-panel h3').should('contain.text', 'Dach')
    cy.get('.info-panel').should('contain.text', 'kWh')
  })

  it('In Individual mode, clicking map shows InfoPanel with single surface title', () => {
    cy.get('.selection-toggle button').contains('Einzeln').click()
    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    cy.get('.info-panel').should('exist').and('be.visible')
    // Single surface title in German
    cy.get('.info-panel h3').should('contain.text', 'Einzelne Dachfläche')
  })

  it('In Multiple mode, clicking map shows InfoPanel with multiple selection title', () => {
    cy.get('.selection-toggle button').contains('Mehrfach').click()
    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    cy.get('.info-panel').should('exist').and('be.visible')
    cy.get('.info-panel h3').should('contain.text', 'Mehrfachauswahl Dach')
  })

  it('In Multiple mode, "New selection" button appears and clears data on click', () => {
    cy.get('.selection-toggle button').contains('Mehrfach').click()
    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    // InfoPanel should be visible
    cy.get('.info-panel').should('exist').and('be.visible')

    // "Neue Auswahl" button should appear on the map
    cy.get('.clear-selection-btn').should('be.visible').and('contain.text', 'Neue Auswahl')

    // Click it to clear
    cy.get('.clear-selection-btn').click()

    // InfoPanel data should be cleared
    cy.get('.info-panel .info-grid').should('not.exist')
  })
})

/**
 * E2E tests for the roofs/facades mode toggle.
 *
 * Covers:
 * - Default mode is "Dach" (roofs) on page load (Req 4.1)
 * - Clicking "Fassade" activates it and deactivates "Dach" (Req 4.2)
 * - In Facades mode, identifying a building shows facade data (Req 4.3)
 * - Toggling mode clears previously displayed data (Req 4.4)
 */

import { setupFindIntercept, setupIdentifyIntercept } from '../support/intercepts'

describe('Mode Toggle (Roofs / Facades)', () => {
  beforeEach(() => {
    cy.interceptGeoAdmin()
    cy.interceptVese()
    cy.visit('/')
  })

  it('Roofs mode ("Dach") is active by default on page load', () => {
    // The first button (Dach) should have the .active class
    cy.get('.mode-toggle button').contains('Dach').should('have.class', 'active')
    // The second button (Fassade) should NOT have the .active class
    cy.get('.mode-toggle button').contains('Fassade').should('not.have.class', 'active')
  })

  it('Clicking "Fassade" button activates it and deactivates "Dach"', () => {
    // Click on Fassade
    cy.get('.mode-toggle button').contains('Fassade').click()

    // Fassade should now be active
    cy.get('.mode-toggle button').contains('Fassade').should('have.class', 'active')
    // Dach should now be inactive
    cy.get('.mode-toggle button').contains('Dach').should('not.have.class', 'active')
  })

  it('In Facades mode, identifying a building shows facade data', () => {
    // Override intercepts with facade fixture for both identify and find.
    setupIdentifyIntercept('identify-facades.json')
    setupFindIntercept('identify-facades.json')

    // Switch to Facades mode
    cy.get('.mode-toggle button').contains('Fassade').click()

    // Click the map to trigger identify
    cy.clickMap(400, 300)

    // Wait for identification request
    cy.wait('@identifyRequest')

    // Verify the InfoPanel shows facade data
    cy.get('.info-panel').should('exist').and('be.visible')
    cy.get('.info-panel').should('contain.text', 'kWh')
  })

  it('Toggling mode clears previously displayed data', () => {
    // First, trigger a building identification in roofs mode
    cy.clickMap(400, 300)
    cy.wait('@identifyRequest')

    // Verify InfoPanel is displayed with roof data (German: "Dach" in title)
    cy.get('.info-panel').should('exist').and('be.visible')
    cy.get('.info-panel h3').should('contain.text', 'Dach')

    // Now toggle to Facades mode — roof data should be cleared
    cy.get('.mode-toggle button').contains('Fassade').click()

    // The roof-specific panel (with roof title) should be gone.
    cy.get('.info-panel h3').should('not.contain.text', 'Dach')
  })
})

/**
 * E2E tests for the roofs/facades mode toggle.
 *
 * Covers:
 * - Default mode is "Dächer" (roofs) on page load (Req 4.1)
 * - Clicking "Fassaden" activates it and deactivates "Dächer" (Req 4.2)
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

  it('Roofs mode ("Dächer") is active by default on page load', () => {
    // The first button (Dächer) should have the .active class
    cy.get('.mode-toggle button').contains('Dächer').should('have.class', 'active')
    // The second button (Fassaden) should NOT have the .active class
    cy.get('.mode-toggle button').contains('Fassaden').should('not.have.class', 'active')
  })

  it('Clicking "Fassaden" button activates it and deactivates "Dächer"', () => {
    // Click on Fassaden
    cy.get('.mode-toggle button').contains('Fassaden').click()

    // Fassaden should now be active
    cy.get('.mode-toggle button').contains('Fassaden').should('have.class', 'active')
    // Dächer should now be inactive
    cy.get('.mode-toggle button').contains('Dächer').should('not.have.class', 'active')
  })

  it('In Facades mode, identifying a building shows facade data', () => {
    // Override intercepts with facade fixture for both identify and find.
    // The find endpoint is used for building surface lookup (needs facade data)
    // and GWR address lookup (non-critical). Using facade fixture satisfies both.
    setupIdentifyIntercept('identify-facades.json')
    setupFindIntercept('identify-facades.json')

    // Switch to Facades mode
    cy.get('.mode-toggle button').contains('Fassaden').click()

    // Click the map to trigger identify
    cy.clickMap(400, 300)

    // Wait for identification request
    cy.wait('@identifyRequest')

    // Verify the InfoPanel shows facade data (facade title in German)
    cy.get('.info-panel').should('exist').and('be.visible')

    // The facade fixture has layerBodId "ch.bfe.solarenergie-eignung-fassaden"
    // and the InfoPanel renders facade-specific content when in facades mode
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
    cy.get('.mode-toggle button').contains('Fassaden').click()

    // The roof-specific panel (with roof title) should be gone.
    // The app either shows loading state or immediately shows facade data (from find intercept).
    cy.get('.info-panel h3').should('not.contain.text', 'Dach')
  })
})

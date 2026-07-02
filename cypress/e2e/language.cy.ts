/**
 * E2E tests for language switching.
 *
 * Covers:
 * - German (DE) is the default language (Req 5.1)
 * - Selecting a language translates UI elements (Req 5.2)
 * - Changing language with data displayed preserves numeric values (Req 5.3)
 * - URL param ?lang=fr loads app in French (Req 5.4)
 */

describe('Language Switching', () => {
  beforeEach(() => {
    cy.interceptGeoAdmin()
    cy.interceptVese()
  })

  it('German (DE) is the default language on load', () => {
    cy.visit('/')

    // Verify the main title is in German
    cy.get('h2.page-title').should(
      'contain.text',
      'Wie viel Strom und Wärme kann mein Dach produzieren?',
    )

    // Verify search placeholder is in German
    cy.get('input.search-input').should('have.attr', 'placeholder', 'Adresse suchen...')

    // Verify the language selector shows DE as selected
    cy.get('.language-switcher select').should('have.value', 'de')
  })

  it('selecting a different language translates title, search placeholder, and mode button labels', () => {
    cy.visit('/')

    // Switch to French
    cy.get('.language-switcher select').select('fr')

    // Verify main title is translated to French
    cy.get('h2.page-title').should(
      'contain.text',
      "Quelle quantité d'électricité et de chaleur mon toit peut-il produire?",
    )

    // Verify search placeholder is translated
    cy.get('input.search-input').should('have.attr', 'placeholder', 'Rechercher une adresse...')

    // Verify mode toggle buttons are translated
    cy.get('.mode-toggle button').eq(0).should('contain.text', 'Toitures')
    cy.get('.mode-toggle button').eq(1).should('contain.text', 'Façades')
  })

  it('changing language with data displayed translates InfoPanel labels but preserves numeric values', () => {
    cy.visit('/')

    // Trigger a search and select to load data into the InfoPanel
    cy.get('input.search-input').clear().type('Bahnhof')
    cy.wait('@searchRequest')
    cy.get('.search-results li').first().click()
    cy.wait('@identifyRequest')

    // Wait for InfoPanel to be visible with data
    cy.get('.info-panel').should('be.visible')

    // Capture numeric values before language switch
    const numericValues: string[] = []
    cy.get('.info-panel .info-value')
      .then(($values) => {
        $values.each((_, el) => {
          numericValues.push(el.textContent?.trim() || '')
        })
      })
      .then(() => {
        // Switch to French
        cy.get('.language-switcher select').select('fr')

        // Verify labels are now in French
        cy.get('.info-panel').should('contain.text', 'Photovoltaïque (électricité)')
        cy.get('.info-panel').should('contain.text', 'Solaire thermique (chaleur)')
        cy.get('.info-panel').should('contain.text', 'Surface totale')
        cy.get('.info-panel').should('contain.text', 'Production électrique')

        // Verify numeric values are preserved (same formatted numbers)
        cy.get('.info-panel .info-value').then(($newValues) => {
          const newNumericValues: string[] = []
          $newValues.each((_, el) => {
            newNumericValues.push(el.textContent?.trim() || '')
          })

          // Extract just the digits from the values to compare (units might change due to translation of "an"/"year")
          const extractNumbers = (values: string[]) =>
            values.map((v) => v.replace(/[^\d'.,]/g, '')).filter((v) => v.length > 0)

          const beforeNumbers = extractNumbers(numericValues)
          const afterNumbers = extractNumbers(newNumericValues)

          // The numeric portions should remain the same
          expect(afterNumbers).to.deep.equal(beforeNumbers)
        })
      })
  })

  it('visiting URL with ?lang=fr loads application in French', () => {
    cy.visit('/?lang=fr')

    // Verify the main title is in French
    cy.get('h2.page-title').should(
      'contain.text',
      "Quelle quantité d'électricité et de chaleur mon toit peut-il produire?",
    )

    // Verify search placeholder is in French
    cy.get('input.search-input').should('have.attr', 'placeholder', 'Rechercher une adresse...')

    // Verify mode toggle buttons are in French
    cy.get('.mode-toggle button').eq(0).should('contain.text', 'Toitures')
    cy.get('.mode-toggle button').eq(1).should('contain.text', 'Façades')

    // Verify the language selector shows FR as selected
    cy.get('.language-switcher select').should('have.value', 'fr')
  })
})

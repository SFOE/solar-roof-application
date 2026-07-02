/**
 * FAQ Section E2E Tests
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 *
 * Tests the accordion behavior of the FAQ section:
 * - Questions visible on load, answers hidden
 * - Expand/collapse on click
 * - Icon toggle (+/−)
 * - aria-expanded attribute toggling
 */

describe('FAQ Accordion', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('all FAQ questions are visible on load and all answers are hidden', () => {
    // There are 6 FAQ questions
    cy.get('.faq-question').should('have.length', 6)

    // All questions should be visible
    cy.get('.faq-question').each(($btn) => {
      cy.wrap($btn).should('be.visible')
    })

    // No answers should be visible (they are not rendered when closed via v-if)
    cy.get('.faq-answer').should('not.exist')
  })

  it('clicking a question shows its answer and changes icon from + to −', () => {
    // Click the first question
    cy.get('.faq-question').first().as('firstQuestion')

    // Verify icon is '+' before click
    cy.get('@firstQuestion').find('.faq-icon').should('have.text', '+')

    // Click to expand
    cy.get('@firstQuestion').click()

    // Answer should now be visible
    cy.get('.faq-answer').should('have.length', 1).and('be.visible')

    // Icon should change to '−'
    cy.get('@firstQuestion').find('.faq-icon').should('have.text', '−')
  })

  it('clicking the same question again hides the answer and reverts icon to +', () => {
    // Open the first question
    cy.get('.faq-question').first().as('firstQuestion')
    cy.get('@firstQuestion').click()

    // Verify it is open
    cy.get('.faq-answer').should('have.length', 1)
    cy.get('@firstQuestion').find('.faq-icon').should('have.text', '−')

    // Click again to close
    cy.get('@firstQuestion').click()

    // Answer should be hidden (removed from DOM via v-if)
    cy.get('.faq-answer').should('not.exist')

    // Icon should revert to '+'
    cy.get('@firstQuestion').find('.faq-icon').should('have.text', '+')
  })

  it('aria-expanded attribute is correctly toggled on each question button', () => {
    // All questions should start with aria-expanded="false"
    cy.get('.faq-question').each(($btn) => {
      cy.wrap($btn).should('have.attr', 'aria-expanded', 'false')
    })

    // Click the third question to expand it
    cy.get('.faq-question').eq(2).as('thirdQuestion')
    cy.get('@thirdQuestion').click()

    // The clicked question should have aria-expanded="true"
    cy.get('@thirdQuestion').should('have.attr', 'aria-expanded', 'true')

    // Other questions should still have aria-expanded="false"
    cy.get('.faq-question').eq(0).should('have.attr', 'aria-expanded', 'false')
    cy.get('.faq-question').eq(1).should('have.attr', 'aria-expanded', 'false')
    cy.get('.faq-question').eq(3).should('have.attr', 'aria-expanded', 'false')
    cy.get('.faq-question').eq(4).should('have.attr', 'aria-expanded', 'false')
    cy.get('.faq-question').eq(5).should('have.attr', 'aria-expanded', 'false')

    // Click the same question again to collapse
    cy.get('@thirdQuestion').click()

    // Should revert to aria-expanded="false"
    cy.get('@thirdQuestion').should('have.attr', 'aria-expanded', 'false')
  })
})

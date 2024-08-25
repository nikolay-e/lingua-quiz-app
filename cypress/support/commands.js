// You can add custom commands here if needed
// For example:

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login.html');
  cy.get('#email').type(email);
  cy.get('#password').type(password);
  cy.get('#login-form').submit();
  cy.get('#login-logout-btn', { timeout: 10000 }).should('be.visible');
  cy.url().should('eq', `${Cypress.config().baseUrl}/`);
});

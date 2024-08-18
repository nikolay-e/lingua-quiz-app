describe('User Authentication', () => {
  const testUser = `test${Date.now()}@example.com`;
  const testPassword = 'testPassword123!';

  it('should register a new user', () => {
    cy.visit('/login.html');
    cy.get('#register-email').type(testUser);
    cy.get('#register-password').type(testPassword);
    cy.get('#register-form').submit();
    cy.contains('Registration successful', { timeout: 10000 }).should('be.visible');
  });

  it('should not allow duplicate registration', () => {
    cy.visit('/login.html');
    cy.get('#register-email').type(testUser);
    cy.get('#register-password').type(testPassword);
    cy.get('#register-form').submit();
    cy.contains('User already exists', { timeout: 10000 }).should('be.visible');
  });

  it('should login with valid credentials', () => {
    cy.visit('/login.html');
    cy.get('#email').type(testUser);
    cy.get('#password').type(testPassword);
    cy.get('#login-form').submit();
    cy.get('#login-logout-btn', { timeout: 10000 }).should('be.visible');
    cy.url().should('eq', `${Cypress.config().baseUrl}/`);
  });

  it('should not login with invalid credentials', () => {
    cy.visit('/login.html');
    cy.get('#email').type(testUser);
    cy.get('#password').type('wrongPassword');
    cy.get('#login-form').submit();
    cy.contains('Invalid credentials', { timeout: 10000 }).should('be.visible');
  });

  it('should logout successfully', () => {
    cy.visit('/login.html');
    cy.get('#email').type(testUser);
    cy.get('#password').type(testPassword);
    cy.get('#login-form').submit();
    cy.get('#login-logout-btn', { timeout: 10000 }).should('be.visible').click();
    cy.url().should('include', '/login.html');
    cy.get('#login-form').should('be.visible');
  });
});

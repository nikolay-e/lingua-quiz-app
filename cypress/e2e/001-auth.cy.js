describe('User Authentication', () => {
  const testUser = `test${Cypress.env('TEST_USER_EMAIL') || `test${Date.now()}@example.com`}`;
  const testPassword = Cypress.env('TEST_USER_PASSWORD') || 'testPassword123!';

  beforeEach(() => {
    cy.visit('/login.html');
  });

  it('should register a new user', () => {
    cy.register(testUser, testPassword);
    cy.contains('Registration successful', { timeout: 10000 }).should('be.visible');
  });

  it('should not allow duplicate registration', () => {
    cy.register(testUser, testPassword);
    cy.contains('User already exists', { timeout: 10000 }).should('be.visible');
  });

  it('should login with valid credentials', () => {
    cy.login(testUser, testPassword);
    cy.url().should('eq', `${Cypress.config().baseUrl}/`);
  });

  it('should not login with invalid credentials', () => {
    cy.login(testUser, 'wrongPassword');
    cy.contains('Invalid credentials', { timeout: 10000 }).should('be.visible');
  });

  it('should logout successfully', () => {
    cy.login(testUser, testPassword);
    cy.logout();
    cy.url().should('include', '/login.html');
    cy.get('#login-form').should('be.visible');
  });

  it('should validate email format', () => {
    cy.get('#register-email').type('invalid-email');
    cy.get('#register-password').type(testPassword);
    cy.get('#register-form').submit();
    cy.contains('Registration failed. Please try again.', { timeout: 10000 }).should('be.visible');
  });

  it('should enforce password strength requirements', () => {
    cy.get('#register-email').type(`strong-password-test-${Date.now()}@example.com`);
    cy.get('#register-password').type('weak');
    cy.get('#register-form').submit();
    cy.contains('Registration failed. Please try again.', { timeout: 10000 }).should('be.visible');
  });

  it('should maintain session after page reload', () => {
    cy.login(testUser, testPassword);
    cy.url().should('eq', `${Cypress.config().baseUrl}/`);
    cy.reload();
    cy.get('#login-logout-btn', { timeout: 10000 }).should('contain', testUser);
  });

  it('should redirect to login page when accessing protected route', () => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.url().should('include', '/login.html');
  });

  it('should handle server errors gracefully', () => {
    cy.intercept('POST', '**/login', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('loginError');
    cy.get('#email').type(testUser);
    cy.get('#password').type(testPassword);
    cy.get('#login-form').submit();
    cy.wait('@loginError');
    cy.contains('Internal Server Error', { timeout: 10000 }).should('be.visible');
  });

  it('should clear user data after logout', () => {
    cy.login(testUser, testPassword);
    cy.logout();
    cy.window().its('localStorage').invoke('getItem', 'token').should('be.null');
    cy.window().its('localStorage').invoke('getItem', 'email').should('be.null');
  });

  it('should not allow access to protected routes after logout', () => {
    cy.login(testUser, testPassword);
    cy.logout();
    cy.visit('/');
    cy.url().should('include', '/login.html');
  });
});

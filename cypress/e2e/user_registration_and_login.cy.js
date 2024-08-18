describe('User Registration and Login', () => {
  // const linguaQuizUrl = process.env.LINGUA_QUIZ_URL;
  const loginPage = `https://lingua-quiz.nikolay-eremeev.com:8443/login.html`;

  const testUser = `test${Date.now()}@example.com`;

  it('should register a new user', () => {
    cy.visit(loginPage);

    cy.get('#register-email').type(testUser);
    cy.get('#register-password').type('testPassword123!');
    cy.get('#register-form').submit();

    cy.contains('Registration successful').should('be.visible');
  });

  it('should not allow duplicate registration', () => {
    cy.visit(loginPage);

    cy.get('#register-email').type(testUser);
    cy.get('#register-password').type('testPassword123!');
    cy.get('#register-form').submit();

    cy.contains('User already exists').should('be.visible');
  });

  it('should login with valid credentials', () => {
    cy.visit(loginPage);

    cy.get('#email').type(testUser);
    cy.get('#password').type('testPassword123!');
    cy.get('#login-form').submit();

    cy.contains('Login successful').should('be.visible');
  });

  it('should not login with invalid credentials', () => {
    cy.visit(loginPage);

    cy.get('#email').type(testUser);
    cy.get('#password').type('wrongPassword');
    cy.get('#login-form').submit();

    cy.contains('Invalid credentials').should('be.visible');
  });
});

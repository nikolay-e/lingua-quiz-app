Cypress.Commands.add('register', (email, password) => {
  cy.visit('/login.html');
  cy.get('#register-email').type(email);
  cy.get('#register-password').type(password);
  cy.get('#register-form').submit();
});

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login.html');
  cy.get('#email').type(email);
  cy.get('#password').type(password);
  cy.get('#login-form').submit();
});

Cypress.Commands.add('apiLogin', (email, password) => {
  cy.request('POST', `${Cypress.config().apiUrl}/login`, { email, password }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body).to.have.property('token');
    localStorage.setItem('token', response.body.token);
    localStorage.setItem('email', email);
  });
});

Cypress.Commands.add('logout', () => {
  cy.get('#login-logout-btn').then(($btn) => {
    if ($btn.text().includes('Logout')) {
      cy.get('#login-logout-btn').click();
      cy.url().should('include', '/login.html');
      cy.get('#login-form').should('be.visible');
      cy.window().its('localStorage').invoke('getItem', 'token').should('be.null');
      cy.window().its('localStorage').invoke('getItem', 'email').should('be.null');
    } else {
      cy.log('User was not logged in, skipping logout process');
    }
  });
});

Cypress.Commands.add('selectQuiz', (quizName) => {
  cy.get('#quiz-select').select(quizName);
  cy.get('#word').should('not.be.empty');
  cy.get('#focus-words-list').should('not.be.empty');
});

Cypress.Commands.add('addWordPair', (listName, sourceWord, targetWord, index) => {
  const generateInt32 = () => Math.floor(Math.random() * 2147483647);
  cy.request({
    method: 'POST',
    url: `${Cypress.config().apiUrl}/word-pair`,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: {
      translationId: generateInt32(),
      sourceWordId: generateInt32(),
      targetWordId: generateInt32(),
      sourceWord,
      targetWord,
      sourceLanguageName: 'English',
      targetLanguageName: 'Spanish',
      wordListName: listName,
      sourceWordUsageExample: `This is an example with ${sourceWord}.`,
      targetWordUsageExample: `Este es un ejemplo con ${targetWord}.`,
    },
  }).then((response) => {
    expect(response.status).to.eq(201);
  });
});

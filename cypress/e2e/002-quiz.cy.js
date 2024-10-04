describe('Quiz Functionality', () => {
  const testUser = `test${Date.now()}@example.com`;
  const testPassword = 'testPassword123!';
  const testWordList = `TestList_${Date.now()}`;
  const testWords = [
    { sourceWord: 'hello', targetWord: 'hola' },
    { sourceWord: 'goodbye', targetWord: 'adiós' },
    { sourceWord: 'cat', targetWord: 'gato' },
    { sourceWord: 'dog', targetWord: 'perro' },
    { sourceWord: 'house', targetWord: 'casa' },
    { sourceWord: 'book', targetWord: 'libro' },
    { sourceWord: 'friend', targetWord: 'amigo' },
    { sourceWord: 'water', targetWord: 'agua' },
    { sourceWord: 'food', targetWord: 'comida' },
    { sourceWord: 'time', targetWord: 'tiempo' },
    { sourceWord: 'family', targetWord: 'familia' },
    { sourceWord: 'love', targetWord: 'amor' },
    { sourceWord: 'car', targetWord: 'coche' },
    { sourceWord: 'school', targetWord: 'escuela' },
    { sourceWord: 'sun', targetWord: 'sol' },
    { sourceWord: 'moon', targetWord: 'luna' },
    { sourceWord: 'tree', targetWord: 'árbol' },
    { sourceWord: 'city', targetWord: 'ciudad' },
    { sourceWord: 'work', targetWord: 'trabajo' },
    { sourceWord: 'music', targetWord: 'música' },
    { sourceWord: 'computer', targetWord: 'ordenador' },
    { sourceWord: 'phone', targetWord: 'teléfono' },
    { sourceWord: 'table', targetWord: 'mesa' },
    { sourceWord: 'chair', targetWord: 'silla' },
    { sourceWord: 'window', targetWord: 'ventana' },
    { sourceWord: 'door', targetWord: 'puerta' },
    { sourceWord: 'world', targetWord: 'mundo' },
    { sourceWord: 'year', targetWord: 'año' },
    { sourceWord: 'day', targetWord: 'día' },
    { sourceWord: 'night', targetWord: 'noche' },
  ];

  before(() => {
    cy.register(testUser, testPassword);
    cy.contains('Registration successful', { timeout: 10000 }).should('be.visible');

    cy.apiLogin(testUser, testPassword);
    testWords.forEach((word, index) => {
      cy.addWordPair(testWordList, word.sourceWord, word.targetWord, index);
    });
  });

  beforeEach(() => {
    cy.login(testUser, testPassword);
    cy.selectQuiz(testWordList);
  });

  afterEach(() => {
    cy.logout();
  });

  it('should load quiz sets and display a question', () => {
    cy.get('#word').should('not.be.empty');
    cy.get('#focus-words-list').should('not.be.empty');
    cy.get('#upcoming-words-list').should('not.be.empty');
    cy.get('#mastered-one-direction-list').should('be.empty');
    cy.get('#mastered-vocabulary-list').should('be.empty');
  });

  it('should submit correct answer and update feedback', () => {
    cy.get('#word')
      .invoke('text')
      .then((word) => {
        const answer =
          testWords.find((w) => w.sourceWord === word)?.targetWord ||
          testWords.find((w) => w.targetWord === word)?.sourceWord;
        cy.get('#answer').type(answer);
        cy.get('#submit').click();
        cy.get('#feedback').should('contain', 'Correct!');
      });
  });

  it('should submit incorrect answer and show correct one', () => {
    cy.get('#word')
      .invoke('text')
      .then((word) => {
        cy.get('#answer').type('incorrect answer');
        cy.get('#submit').click();
        cy.get('#feedback').should('contain', 'Wrong');
        cy.get('#feedback').should('contain', word);
      });
  });
});

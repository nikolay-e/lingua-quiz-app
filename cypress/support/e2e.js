import './commands';

Cypress.on('uncaught:exception', (_err, _runnable) => {
  // returning false here prevents Cypress from
  // failing the test on uncaught exceptions
  return false;
});

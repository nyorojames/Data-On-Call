// Cypress support file

beforeEach(() => {
  // Global safety stub: intercept all /api/log requests to guarantee tests never write to data/oturumlar.csv
  cy.intercept('POST', '/api/log', {
    statusCode: 204,
    headers: {
      'x-data-collection': 'false',
    },
  }).as('globalLogStub');
});

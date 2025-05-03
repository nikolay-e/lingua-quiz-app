/*
 * LinguaQuiz – Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 */
const { expect } = require('chai');

const { safeApiCall } = require('./testHelpers');

describe('Health Check', () => {
  it('should return OK status', async () => {
    // Make a request to the health endpoint
    const response = await safeApiCall('get', '/health');

    // Verify the response
    expect(response.status).to.equal(200);
    expect(response.data.status).to.equal('ok');

    // Optionally check for database status if available
    if (response.data.components && response.data.components.database) {
      expect(response.data.components.database.status).to.equal('ok');
    }
  });
});

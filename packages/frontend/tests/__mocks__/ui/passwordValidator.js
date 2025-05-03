/**
 * Standard mock for the PasswordValidator class.
 * This provides a lightweight implementation for tests where password validation
 * is not the primary focus.
 */

export class PasswordValidator {
  constructor() {
    this.requirements = [
      { id: 'length', text: 'At least 8 characters', valid: false },
      { id: 'uppercase', text: 'At least one uppercase letter', valid: false },
      { id: 'lowercase', text: 'At least one lowercase letter', valid: false },
      { id: 'number', text: 'At least one number', valid: false },
      { id: 'special', text: 'At least one special character', valid: false },
    ];

    // Create mock functions with mockName for better error messages
    this.validatePassword = jest.fn().mockName('PasswordValidator.validatePassword');
    this.createValidationContainer = jest
      .fn()
      .mockName('PasswordValidator.createValidationContainer');
    this.updateRequirement = jest.fn().mockName('PasswordValidator.updateRequirement');

    // Default implementations
    this.validatePassword.mockImplementation(() => true);
    this.createValidationContainer.mockImplementation(() => {
      const container = document.createElement('div');
      container.className = 'password-requirements';
      return container;
    });
    this.updateRequirement.mockImplementation((id, valid) => {
      const req = this.requirements.find((r) => r.id === id);
      if (req) req.valid = valid;
    });
  }

  // Helper to reset all mocks
  _reset() {
    this.validatePassword.mockClear();
    this.createValidationContainer.mockClear();
    this.updateRequirement.mockClear();

    // Reset requirements state
    for (const req of this.requirements) {
      req.valid = false;
    }
  }
}

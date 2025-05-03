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
export class PasswordValidator {
  constructor() {
    this.requirements = [
      {
        id: 'length',
        label: 'At least 8 characters long',
        validate: (pwd) => pwd.length >= 8,
      },
      {
        id: 'uppercase',
        label: 'Contains at least one uppercase letter',
        validate: (pwd) => /[A-Z]/.test(pwd),
      },
      {
        id: 'lowercase',
        label: 'Contains at least one lowercase letter',
        validate: (pwd) => /[a-z]/.test(pwd),
      },
      {
        id: 'number',
        label: 'Contains at least one number',
        validate: (pwd) => /\d/.test(pwd),
      },
      {
        id: 'special',
        label: 'Contains at least one special character',
        validate: (pwd) => /[!"#$%&()*,.:<>?@^{|}]/.test(pwd),
      },
    ];
  }

  createValidationContainer() {
    const container = document.createElement('div');
    container.className = 'password-requirements';

    const title = document.createElement('div');
    title.textContent = 'Password Requirements:';
    title.className = 'password-requirements-title';
    container.append(title);

    const requirementsList = document.createElement('div');
    requirementsList.className = 'requirements-list';

    for (const req of this.requirements) {
      const requirement = document.createElement('div');
      requirement.className = 'requirement';
      requirement.id = `req-${req.id}`;

      const icon = document.createElement('span');
      icon.className = 'requirement-icon';
      icon.innerHTML = '○';

      const label = document.createElement('span');
      label.textContent = req.label;

      requirement.append(icon);
      requirement.append(label);
      requirementsList.append(requirement);
    }

    container.append(requirementsList);
    return container;
  }

  updateRequirement(requirement, isValid) {
    const reqElement = document.getElementById(`req-${requirement.id}`);

    // If element doesn't exist yet, create it if possible
    if (!reqElement) {
      // Check if container exists, if not we just return (can't create floating elements)
      const container = document.querySelector('.password-requirements .requirements-list');
      if (!container) return;

      // Create the requirement element
      const newReqElement = document.createElement('div');
      newReqElement.className = 'requirement';
      newReqElement.id = `req-${requirement.id}`;

      const icon = document.createElement('span');
      icon.className = 'requirement-icon';

      const label = document.createElement('span');
      label.textContent = requirement.label;

      newReqElement.append(icon);
      newReqElement.append(label);
      container.append(newReqElement);

      // Now update the newly created element
      this.updateExistingRequirement(newReqElement, isValid);
      return;
    }

    // Update existing element
    this.updateExistingRequirement(reqElement, isValid);
  }

  // Helper method to update an existing requirement element
  updateExistingRequirement(reqElement, isValid) {
    const icon = reqElement.querySelector('.requirement-icon');
    if (!icon) return; // Should not happen, but just in case

    if (isValid) {
      icon.innerHTML = '✓';
      icon.classList.add('valid');
      reqElement.classList.add('valid');
    } else {
      icon.innerHTML = '○';
      icon.classList.remove('valid');
      reqElement.classList.remove('valid');
    }
  }

  validatePassword(password) {
    let isValid = true;
    for (const requirement of this.requirements) {
      const reqValid = requirement.validate(password);
      this.updateRequirement(requirement, reqValid);
      if (!reqValid) isValid = false;
    }
    return isValid;
  }
}

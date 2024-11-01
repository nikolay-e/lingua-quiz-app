// eslint-disable-next-line import/prefer-default-export
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
        validate: (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      },
    ];
  }

  createValidationContainer() {
    const container = document.createElement('div');
    container.className = 'password-requirements';

    const title = document.createElement('div');
    title.textContent = 'Password Requirements:';
    title.className = 'password-requirements-title';
    container.appendChild(title);

    const requirementsList = document.createElement('div');
    requirementsList.className = 'requirements-list';

    this.requirements.forEach((req) => {
      const requirement = document.createElement('div');
      requirement.className = 'requirement';
      requirement.id = `req-${req.id}`;

      const icon = document.createElement('span');
      icon.className = 'requirement-icon';
      icon.innerHTML = '○';

      const label = document.createElement('span');
      label.textContent = req.label;

      requirement.appendChild(icon);
      requirement.appendChild(label);
      requirementsList.appendChild(requirement);
    });

    container.appendChild(requirementsList);
    return container;
  }

  // eslint-disable-next-line class-methods-use-this
  updateRequirement(requirement, isValid) {
    const reqElement = document.getElementById(`req-${requirement.id}`);
    if (!reqElement) return;

    const icon = reqElement.querySelector('.requirement-icon');
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
    this.requirements.forEach((requirement) => {
      const reqValid = requirement.validate(password);
      this.updateRequirement(requirement, reqValid);
      if (!reqValid) isValid = false;
    });
    return isValid;
  }
}

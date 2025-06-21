# **LLM-Centric Development Rules**

This codebase is optimized for LLM-driven development velocity, with a human providing strategic oversight for quality and long-term architecture.

## **Core Principles**

- **Direct Implementation**: Minimize unnecessary abstractions and design patterns to accelerate development.
- **Self-Documenting Code Through Naming**: Variable, function, and file names must clearly explain their purpose. Code should be understandable without excessive comments. Quality naming is mandatory.
- **LLM-First for Feature Tasks**: Code organization for new features is optimized for LLM context windows and token efficiency.
- **Separation of Concerns**: A clear distinction is made between `Feature Tasks` and `Architectural Tasks`, which follow different rules.
- **Minimal Change Principle (for Feature Tasks)**: When implementing features, make only the changes without which the functionality will not work. This reduces risk and simplifies code review.
- **Human-Driven Architectural Oversight**: A human initiates and governs all architectural improvements and refactoring to manage technical debt and ensure the project's long-term health.

## **Benefits**

- **High-Velocity Development**: Rapidly execute tactical feature tasks using an LLM.
- **Strategic Oversight**: A human manages long-term quality and architecture, preventing stagnation.
- **Reduced Risk**: The Minimal Change Principle for features minimizes the likelihood of regressions.
- **Clarity and Cleanliness**: The requirement for self-documenting code via good naming maintains readability.
- **Deployment Confidence**: Mandatory E2E testing in a production-like Docker environment ensures changes will work when deployed.

## **Development and Testing Requirements**

### **Separation of Work Types**

There are two distinct types of tasks, each with its own set of rules:

1.  **Feature Tasks**:
    - **Goal**: To implement specific, user-facing functionality.
    - **Rule**: Must strictly adhere to the **"Minimal Change Principle"**.

2.  **Architectural Tasks**:
    - **Goal**: To refactor code, upgrade dependencies, improve structure, or pay down technical debt.
    - **Rule**: Are initiated **by a human only** in separate pull requests. They are **exempt** from the strict "Minimal Change Principle".

### **Enforcing the "Minimal Change Principle" (for Feature Tasks)**

**🚨 CRITICAL RULE: For feature work, use `git diff main` before any commit to ensure absolute minimal changes.**

- **Definition of "Absolutely Necessary"**: A change is absolutely necessary only if the required functionality will not work without it.
- **Before Committing**: Run `git diff main` to review EVERY single change.
- **Revert Unnecessary Changes**: Any modification not absolutely necessary for the feature's operation must be reverted.
- **Examples of unnecessary changes to AVOID (in Feature Tasks)**:
  - Reformatting existing, working code.
  - Upgrading dependencies unless required for the feature.
  - Adding comments or documentation to existing working code.
  - Refactoring existing code structure if it does not block the task.

### **Mandatory Integration Testing via Docker Compose**

**🚨 CRITICAL RULE: All changes (both Feature and Architectural) MUST be tested using Docker Compose.**

- **Rationale**: A minimalist codebase combined with comprehensive integration (E2E) tests provides sufficient coverage, replacing the need for unit tests. Good logging practices enable rapid problem identification when an E2E test fails.
- **No Exceptions**: Testing in a local development environment is insufficient.
- **Process for Verification**:
  1.  After making code changes, the entire project stack must be rebuilt and restarted.
  2.  Run `docker-compose down` to stop any running containers.
  3.  Run `docker-compose up --build -d`. The `--build` flag is **mandatory** to ensure container images are always rebuilt to reflect the latest code changes. The `-d` flag runs containers in detached mode.
  4.  **E2E Tests Run Automatically**: The e2e-tests container starts automatically and runs the complete test suite. Monitor the logs with `docker compose logs e2e-tests -f` to see test results.
  5.  Check the logs of all services (`docker-compose logs <service-name>`) for any errors or warnings.
  6.  Verify that the application and all affected functionality work correctly within the containerized environment.
- **Task Completion**: A task is only considered complete when it runs flawlessly in the Docker Compose environment AND all E2E tests pass.

### **End-to-End Testing Requirements**

**🚨 CRITICAL RULE: E2E tests must be run using Docker containers, not local npm/playwright installations.**

- **Correct E2E Test Execution**:
  ```bash
  # Stop any running services
  docker compose down
  
  # Start core services with health checks
  docker compose up --build -d db backend frontend
  
  # Wait for services to be healthy, then run E2E tests
  docker compose up --build e2e-tests
  ```
- **E2E Test Environment**: Tests run in isolated Docker containers with proper networking, ensuring consistent results across different development environments.
- **Test Results**: Test results and videos are saved to `test-results/` directory for debugging failed tests.
- **Browser Coverage**: Tests run across multiple browsers (Chromium, Firefox, WebKit) and devices (desktop, mobile) as configured in `playwright.config.js`.

### **Why This Process is Required**

- **Production Parity**: Docker Compose mirrors the production deployment environment.
- **Reliability**: Verifying inter-service communication ensures the system works as a whole.
- **Efficient Debugging**: The combination of a minimal codebase and detailed logging allows for the root cause of a failing integration test to be found quickly.
- **Deployment Confidence**: Guarantees that what works in testing will work when deployed.
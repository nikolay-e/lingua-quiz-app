# LinguaQuiz 🎯

A full-stack language learning web application that helps users master vocabulary through an
intelligent spaced repetition system. Built with modern JavaScript and deployed on Kubernetes.

## Project Overview 🚀

LinguaQuiz takes an approach to language learning by implementing an algorithm that adapts to user
performance. The application tracks word mastery in both directions (source → target language and
vice versa) and intelligently selects which words to practice based on error frequency and mastery
level.

### Tech Stack 🛠️

- **Frontend**: Vanilla JavaScript (ES6+), focusing on clean, maintainable code without framework
  overhead
- **Backend**: Node.js, Express.js, PostgreSQL with advanced SQL functions and triggers
- **Infrastructure**: Docker, Kubernetes, GitHub Actions, Nginx
- **Testing**: Jest for unit tests, Playwright for comprehensive E2E testing

Want to see it in action? Check out the [live demo](https://lingua-quiz.nikolay-eremeev.com/)

## Getting Started Locally (using Docker Compose) 🐳

These instructions will help you get a local copy of LinguaQuiz up and running on your machine using
Docker for development and testing purposes.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Git:** To clone the repository.
- **Docker:** The containerization platform. Download from
  [Docker's website](https://www.docker.com/products/docker-desktop/).
- **Docker Compose:** Usually included with Docker Desktop. If not, follow the
  [official installation guide](https://docs.docker.com/compose/install/).

### Installation Steps

1.  **Clone the Repository:** Open your terminal or command prompt and clone the project:

    ```bash
    git clone https://github.com/nikolay-e/lingua-quiz.git
    cd lingua-quiz
    ```

2.  **Review and Modify Environment Variables:** The application uses a `.env` file in the project
    root for configuration. It's included in the repository with default values intended **only for
    local Docker Compose testing**.

    - **Important Note on Defaults:**

      - The default `POSTGRES_PASSWORD` and `JWT_SECRET` are public. They are suitable **only** for
        running the app locally with `docker compose up` for quick testing.
      - **Do not use these defaults outside of this specific local test setup** (e.g., in
        production, staging, or shared environments). For any deployment, use secure, unique secrets
        managed appropriately (e.g., via environment variables or secret management tools).

    - **Git Tip:** Since `.env` is tracked, if you modify it locally (e.g., ports), you can tell Git
      to ignore your local changes temporarily using `git update-index --skip-worktree .env` to
      avoid accidental commits. Use `--no-skip-worktree` to track changes again.

3.  **Build and Run the Core Application:** Navigate to the project's root directory (where
    `docker-compose.yml` is located) in your terminal and run:

    ```bash
    docker compose up --build -d db backend frontend
    ```

    - `--build`: Forces Docker Compose to build the images (backend, frontend) based on their
      Dockerfiles before starting the containers. Recommended for the first run or after code
      changes.
    - `-d`: Runs the containers in detached mode (in the background).

    The first time you run this, it might take a while as Docker downloads base images and builds
    your application images.

4.  **Accessing LinguaQuiz:** Once the containers are up and running (check `docker ps` or
    `docker compose ps`), you can access the application:
    - **Frontend:** Open your web browser and go to `http://localhost:8080`.
    - **Backend API:** The API will be available at `http://localhost:9000`. Useful for development
      or API testing tools.

### Test Organization

LinguaQuiz has a comprehensive testing strategy with four distinct layers:

#### 1. Unit Tests

- Tests individual functions and components in isolation
- No external dependencies or network calls
- Fast execution for quick feedback loops
- Run with: `npm run test:unit`

#### 2. Integration Tests

- Tests interactions between related components
- Runs in the local environment with mocked dependencies
- Verifies code interfaces work correctly together
- Run with: `npm run test:integration`

#### 3. Component Tests

- Tests service boundaries and API contracts
- Uses containerized dependencies when needed
- Simulates real service interactions in isolated environments
- Run with: `npm run test:component`

#### 4. End-to-End (E2E) Tests

- Tests complete user flows through the entire application
- Uses Playwright to automate browser interactions
- Verifies critical functionality from the user's perspective
- Run with: `npm run test:e2e`

### Running End-to-End (E2E) Tests

LinguaQuiz includes a comprehensive end-to-end test suite using Playwright that verifies critical
application flows including authentication, user sessions, and quiz functionality.

To run the E2E tests:

1. First, start the application:

   ```bash
   docker compose up -d
   ```

2. Then run the tests:
   ```bash
   npm run test:e2e
   ```

#### Additional E2E Test Commands

- Run specific test suites:
  - Authentication tests: `npm run test:e2e:auth`
  - Quiz functionality: `npm run test:e2e:quiz`
- Run with faster quiz settings: `npm run test:e2e:fast`
- Run with debug mode: `npm run test:e2e:debug`
- Run in a specific browser: `npm run test:e2e:chromium`
- View the test report: `npm run test:report`

## Licensing 📝

LinguaQuiz is released under a **dual licence** model:

1. **Source-Available Non-Commercial License v2** (free) - For personal, educational, and non-profit
   use. Requires sharing source code of any derivatives.

2. **Proprietary Commercial License v2** (paid) - For business and commercial use. Allows
   object-code-only distribution.

This approach balances open usage for education/research with sustainable development through
commercial licensing. German law applies with venue in Berlin.

Please see [LICENSING.md](LICENSING.md) for detailed information on both license options and to
determine which is appropriate for your use case.

For commercial licensing inquiries, please contact: lingua-quiz@nikolay-eremeev.com

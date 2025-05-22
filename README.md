# LinguaQuiz 🎯

A full-stack language learning web application that helps users master vocabulary through an intelligent spaced repetition system. Built with modern
JavaScript and deployed on Kubernetes.

## Project Overview 🚀

LinguaQuiz takes an approach to language learning by implementing an algorithm that adapts to user performance. The application tracks word mastery in
both directions (source → target language and vice versa) and intelligently selects which words to practice based on error frequency and mastery
level.

### Tech Stack 🛠️

- **Frontend**: Vanilla JavaScript (ES6+), focusing on clean, maintainable code without framework overhead
- **Backend**: Node.js, Express.js, PostgreSQL with advanced SQL functions and triggers
- **Infrastructure**: Docker, Kubernetes, GitHub Actions, Nginx
- **Testing**: Jest, Playwright for cross-browser testing

Want to see it in action? Check out the [live demo](https://lingua-quiz.nikolay-eremeev.com/)

## Getting Started Locally (using Docker Compose) 🐳

These instructions will help you get a local copy of LinguaQuiz up and running on your machine using Docker for development and testing purposes.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Git:** To clone the repository.
- **Docker:** The containerization platform. Download from [Docker's website](https://www.docker.com/products/docker-desktop/).
- **Docker Compose:** Usually included with Docker Desktop. If not, follow the
  [official installation guide](https://docs.docker.com/compose/install/).

### Installation Steps

1.  **Clone the Repository:** Open your terminal or command prompt and clone the project:

    ```bash
    git clone https://github.com/nikolay-e/lingua-quiz.git
    cd lingua-quiz
    ```

2.  **Review and Modify Environment Variables:** The application uses a `.env` file in the project root for configuration. It's included in the
    repository with default values intended **only for local Docker Compose testing**.

    - **Important Note on Defaults:**

      - The default `POSTGRES_PASSWORD` and `JWT_SECRET` are public. They are suitable **only** for running the app locally with `docker compose up`
        for quick testing.
      - **Do not use these defaults outside of this specific local test setup** (e.g., in production, staging, or shared environments). For any
        deployment, use secure, unique secrets managed appropriately (e.g., via environment variables or secret management tools).

    - **Git Tip:** Since `.env` is tracked, if you modify it locally (e.g., ports), you can tell Git to ignore your local changes temporarily using
      `git update-index --skip-worktree .env` to avoid accidental commits. Use `--no-skip-worktree` to track changes again.

3.  **Build and Run the Core Application:** Navigate to the project's root directory (where `docker-compose.yml` is located) in your terminal and run:

    ```bash
    docker compose up --build -d db backend frontend
    ```

    - `--build`: Forces Docker Compose to build the images (backend, frontend) based on their Dockerfiles before starting the containers. Recommended
      for the first run or after code changes.
    - `-d`: Runs the containers in detached mode (in the background).

    The first time you run this, it might take a while as Docker downloads base images and builds your application images.

4.  **Accessing LinguaQuiz:** Once the containers are up and running (check `docker ps` or `docker compose ps`), you can access the application:
    - **Frontend:** Open your web browser and go to `http://localhost:8080`.
    - **Backend API:** The API will be available at `http://localhost:9000`. Useful for development or API testing tools.

### Running End-to-End (E2E) Tests

The E2E tests run in a separate service (`e2e-tests`) defined in the `docker-compose.yml`. To include this service when starting the application:

```bash
docker compose up --build e2e-tests
```

## Deployment Architecture 🚢

LinguaQuiz uses Kubernetes for cloud deployment, providing a scalable and maintainable infrastructure.

### Unified Helm Chart

The application is deployed using a single unified Helm chart located in `./helm/lingua-quiz-app/`. This chart manages:

- Frontend deployment (Nginx serving static files)
- Backend API deployment
- PostgreSQL database (using StatefulSet)
- Ingress configuration for both services
- Secret management

> **Note**: Legacy Helm charts in `packages/backend/helm/` are deprecated and will be removed in a future update.

### Deployment Strategy

- **CI/CD Pipeline**: GitHub Actions automates the build, test, and deployment process
- **Docker Images**: Frontend and backend are containerized separately
- **Kubernetes Deployment**: Both components are deployed to Kubernetes
- **Ingress**: Configured to route traffic to frontend and API endpoints
- **TLS**: HTTPS encryption for all endpoints
- **Database Backups**: Automated backups using CronJobs

### Detailed Documentation

For a more detailed explanation of the deployment process, see:

- GitHub Actions workflows in `.github/workflows/`
- Helm chart templates in `./helm/lingua-quiz-app/templates/`
- Kubernetes resource configurations

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

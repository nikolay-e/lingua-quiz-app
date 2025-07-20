# LinguaQuiz 🎯

A language learning web application that helps users master vocabulary through spaced repetition. Live demo: [lingua-quiz.nikolay-eremeev.com](https://lingua-quiz.nikolay-eremeev.com/)

## Quick Start with Docker Compose 🐳

1. **Prerequisites**: Install [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose

2. **Clone and Run**:
   ```bash
   git clone https://github.com/nikolay-e/lingua-quiz.git
   cd lingua-quiz
   docker compose up --build -d db backend frontend
   ```

3. **Access the App**:
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:9000

4. **Run Tests** (optional):
   ```bash
   docker compose up --build e2e-tests
   ```

## Documentation 📚

- [Development Guidelines](docs/development-rules.md) - LLM-centric development approach
- [System Architecture](docs/system-architecture.md) - Technical design and components
- [Learning Algorithm](docs/spaced-repetition-algorithm.md) - How the spaced repetition works
- [Answer Validation](docs/answer-comparison-logic.md) - Translation answer matching rules

## Tech Stack

**Frontend**: Svelte 4.0, Vite  
**Backend**: Python 3.11, Flask, PostgreSQL  
**Infrastructure**: Docker, Kubernetes, Helm  
**Testing**: Playwright E2E tests

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

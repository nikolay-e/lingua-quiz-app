# LinguaQuiz 🎯

![CI/CD](https://img.shields.io/github/actions/workflow/status/nikolay-e/lingua-quiz/ci-cd.yml?branch=main&style=flat-square&logo=github&label=CI/CD)
![Live Demo](https://img.shields.io/badge/demo-live-green?style=flat-square&logo=vercel&logoColor=white)
![Docker](https://img.shields.io/badge/docker-ready-blue?style=flat-square&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/kubernetes-ready-blue?style=flat-square&logo=kubernetes&logoColor=white)
![License](https://img.shields.io/badge/license-Dual%20(Non--Commercial%20%2F%20Commercial)-blue?style=flat-square)
![FastAPI](https://img.shields.io/badge/FastAPI-modern-009688?style=flat-square&logo=fastapi&logoColor=white)
![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?style=flat-square&logo=svelte&logoColor=white)

A language learning web application that helps users master vocabulary through spaced repetition.

## Quick Start with Docker Compose 🐳

1. **Prerequisites**: Install [Docker](https://www.docker.com/products/docker-desktop/) and Docker Compose

2. **Clone and Setup**:
   ```bash
   git clone https://github.com/nikolay-e/lingua-quiz.git
   cd lingua-quiz
   cp .env.example .env
   # Edit .env with your values
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

**Frontend**: Svelte 5, Vite  
**Backend**: Python 3.11, FastAPI, PostgreSQL  
**Infrastructure**: Docker, Kubernetes, Helm  
**Testing**: Playwright E2E tests

## Licensing 📄

This project uses **dual licensing**:
- **Non-Commercial**: Free for personal, academic, and evaluation use
- **Commercial**: Paid license required for business use

See [LICENSING.md](LICENSING.md) for details or contact [lingua-quiz@nikolay-eremeev.com](mailto:lingua-quiz@nikolay-eremeev.com) for commercial licensing.

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.
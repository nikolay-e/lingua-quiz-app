# LinguaQuiz 🎯

A language learning web application that helps users master vocabulary through spaced repetition. Live demo: [lingua-quiz.nikolay-eremeev.com](https://lingua-quiz.nikolay-eremeev.com/)

## Quick Start with Local Kubernetes 🚀

1. **Prerequisites**:
   - [Docker Desktop](https://www.docker.com/products/docker-desktop/) with Kubernetes enabled
   - [kubectl](https://kubernetes.io/docs/tasks/tools/)
   - [Helm](https://helm.sh/docs/intro/install/)
   - NGINX Ingress Controller:
     ```bash
     kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml
     ```

2. **Clone and Deploy**:

   ```bash
   git clone https://github.com/nikolay-e/lingua-quiz.git
   cd lingua-quiz
   make local
   ```

3. **Access the App**:
   - Frontend: http://localhost
   - Backend API: http://localhost/api

4. **Clean Up**:
   ```bash
   make clean-local
   ```

## Documentation 📚

- [Development Guidelines](docs/tech.md#development--testing) - LLM-centric development approach
- [System Architecture](docs/tech.md#system-architecture) - Technical design and components
- [Learning Algorithm](docs/tech.md#learning-algorithm-quiz-core) - How the spaced repetition works
- [Answer Validation](docs/tech.md#answer-validation-logic-quiz-core) - Translation answer matching rules

## Tech Stack

**Frontend**: Svelte 5, Vite 7
**Backend**: Python 3.13, FastAPI, PostgreSQL
**Infrastructure**: Docker, Kubernetes, Helm
**Testing**: Playwright E2E tests, Python integration tests

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request.

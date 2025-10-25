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

## Production Deployment with FluxCD 🚀

LinguaQuiz uses **FluxCD** for GitOps-based continuous deployment to Kubernetes clusters.

### Quick Start

```bash
# Bootstrap FluxCD for production
cd flux
./bootstrap.sh production

# Check deployment status
flux get all
flux get helmreleases -n lingua-quiz-production
```

### How It Works

1. **CI Pipeline** (GitHub Actions):
   - Runs tests on every PR
   - Builds Docker images
   - Pushes images to GitHub Container Registry

2. **CD Pipeline** (FluxCD):
   - Monitors GHCR for new images
   - Automatically updates Kubernetes deployments
   - Manages secrets with SOPS encryption
   - Provides automated rollbacks on failure

### Features

- ✅ Automated image updates from GHCR
- ✅ SOPS-encrypted secrets
- ✅ Separate production and staging environments
- ✅ No direct cluster access from CI/CD
- ✅ GitOps workflow with full audit trail

See [flux/README.md](flux/README.md) for detailed setup instructions.

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

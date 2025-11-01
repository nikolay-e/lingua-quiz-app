# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT: Workspace-Level Configuration Inheritance**

This project inherits configuration from the workspace root:

- Read `../CLAUDE.md` for core development principles (testing, documentation, git workflow)
- Read `../private/SYSTEM_SETUP.md` for workspace infrastructure and communication guidelines
- `.claude/settings.json` → symlink to `../../.claude/settings.json` (hooks, permissions, automation)
- `.claude/commands/` → symlink to `../../.claude/commands/` (slash commands: /setup, /review, /test, /commit, /bl)
- Local overrides: `.claude/settings.local.json` (project-specific settings)

**Communication:** Always use Russian with user, English for code/comments/docs.

## Project Overview

Lingua Quiz is a language learning quiz application built as an npm workspaces monorepo using TypeScript and Svelte.

## Technology Stack

- **Language**: TypeScript
- **UI Framework**: Svelte
- **Package Manager**: npm (workspaces)
- **Build Tool**: Vite
- **Code Quality**: ESLint, Prettier, pre-commit hooks

## Monorepo Structure

```
packages/
├── core/                  # Framework-agnostic business logic
├── frontend/              # Svelte UI components and routes
├── backend/               # Backend API (if applicable)
├── integration-tests/     # Integration/E2E tests
└── word-processing/       # Word processing utilities
```

Each package is independent but may depend on other packages in the workspace.

## Development Commands

### Setup

```bash
# Install all workspace dependencies
npm install

# Install dependencies for specific package
npm install --workspace=@lingua-quiz/core
npm install --workspace=@lingua-quiz/frontend
```

### Development

```bash
# Run development server (adjust based on actual setup)
npm run dev

# Run specific package dev server
npm run dev --workspace=@lingua-quiz/frontend
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@lingua-quiz/core
```

### Testing

Following workspace-level CLAUDE.md principle: **NO UNIT TESTS - ONLY INTEGRATION/E2E TESTS**

```bash
# Run integration/E2E tests
npm run test

# Run tests for specific package
npm run test --workspace=@lingua-quiz/integration-tests

# Watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint all packages
npm run lint

# Lint specific package
npm run lint --workspace=@lingua-quiz/frontend

# Format all code
npm run format

# Format specific package
npm run format --workspace=@lingua-quiz/core

# Pre-commit hooks
pre-commit run --all-files
```

## Package Dependencies

**Important**: Build order may matter due to inter-package dependencies.

```bash
# Typical build order (core → backend → frontend)
npm run build --workspace=@lingua-quiz/core
npm run build --workspace=@lingua-quiz/backend
npm run build --workspace=@lingua-quiz/frontend

# The root `npm run build` should handle this automatically
```

## Architecture

### Core Package (`packages/core/`)

Framework-agnostic business logic:

- Quiz logic and state management
- Language processing utilities
- Data models and types

### Frontend Package (`packages/frontend/`)

Svelte UI components and routes:

- Quiz interface components
- Navigation and routing
- User interaction logic

### Backend Package (`packages/backend/`)

Backend API (if applicable):

- API endpoints
- Data persistence
- Authentication (if applicable)

### Integration Tests (`packages/integration-tests/`)

E2E tests that verify complete workflows:

- Quiz completion flows
- User interactions
- Data persistence
- Multi-package integration

### Word Processing (`packages/word-processing/`)

Utilities for language and word processing:

- Text analysis
- Language-specific utilities
- Quiz generation logic

## Key Files

- `package.json` (root) - Workspace configuration and scripts
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration
- `.pre-commit-config.yaml` - Pre-commit hooks
- `.prettierrc` - Prettier formatting rules

## Testing Strategy

**Integration/E2E Tests ONLY:**

- Test complete quiz workflows
- Test multi-package interactions
- Test against real components (no mocking)
- Use Vitest or Playwright for E2E tests

**No Unit Tests:**

- Following workspace-level principle
- Focus on integration and E2E tests
- Test actual user workflows

## Common Tasks

### Adding New Quiz Type

1. Update core logic in `packages/core/`
2. Build core: `npm run build --workspace=@lingua-quiz/core`
3. Add UI components in `packages/frontend/`
4. Add integration tests in `packages/integration-tests/`
5. Run tests to verify: `npm run test`

### Running Specific Package

```bash
# Navigate to package directory
cd packages/frontend

# Run package-specific commands
npm run dev
npm run build
npm test
```

### Checking Type Safety

```bash
# Type check all packages
npm run type-check

# Type check specific package
npm run type-check --workspace=@lingua-quiz/core
```

## Docker (if configured)

```bash
# Build and run with Docker Compose
docker-compose up --build

# Access application
# http://localhost:PORT
```

## Deployment

### Build for Production

```bash
# Build all packages
npm run build

# Output typically in packages/*/dist/
```

### Environment Variables

Check `.env.example` for required environment variables (if applicable).

## Troubleshooting

### Package Not Found Errors

```bash
# Rebuild all packages
npm run build

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules
npm install
```

### TypeScript Errors

```bash
# Check tsconfig.json paths
cat tsconfig.json

# Rebuild packages
npm run build
```

### Pre-commit Hook Failures

```bash
# Run specific hook
pre-commit run prettier --all-files
pre-commit run eslint --all-files

# Update hooks
pre-commit autoupdate
```

## Code Quality Standards

- **TypeScript strict mode**: All packages use strict type checking
- **ESLint**: Enforced code quality rules
- **Prettier**: Consistent code formatting
- **Pre-commit hooks**: Automated quality checks
- **No linting/formatting errors allowed**: All must pass before commit

## Quick Start

```bash
# Setup
npm install

# Run development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

## Related Documentation

- README.md - User-facing documentation
- packages/\*/README.md - Package-specific documentation
- package.json - Workspace configuration and available scripts

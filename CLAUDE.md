# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Build & Test Commands

**IMPORTANT: ALWAYS use root package.json scripts when available instead of manual commands.**

### Development
- **Start UI**: `npm run dev:ui` (frontend dev server)
- **Start API**: `npm run dev:api` (backend server)
- **Build UI**: `npm run build:ui` (build frontend for production)

### Database
- **Run Migrations**: `npm run db:migrate` (setup/update database schema)

### Testing
- **All Tests**: `npm run test` (runs all unit + integration tests)
- **Unit Tests**: `npm run test:unit` (runs all unit tests)
- **Frontend Unit Tests**: `npm run test:unit:frontend` (frontend Jest tests)
- **Backend Unit Tests**: `npm run test:unit:backend` (backend utility/middleware tests)
- **Integration Tests**: `npm run test:integration` (runs all integration tests)
- **Frontend Integration Tests**: `npm run test:integration:frontend` (core component integration tests)
- **Frontend Integration Tests (All)**: `npm run test:integration:frontend:all` (all frontend integration tests)
- **Backend Integration Tests**: `npm run test:integration:backend` (backend API tests)
- **E2E Tests**: `npm run test:e2e` (all end-to-end tests)
- **E2E Auth Tests**: `npm run test:e2e:auth` (auth feature tests)
- **E2E Quiz Tests**: `npm run test:e2e:quiz` (quiz feature tests)
- **E2E Fast Quiz**: `npm run test:e2e:fast` (uses fast word mastery mode)
- **E2E Debug Mode**: `npm run test:e2e:debug` (with API debugging)
- **E2E Chromium Only**: `npm run test:e2e:chromium` (tests in Chromium browser)
- **Docker Up**: `npm run docker:up` (starts all services in docker containers)
- **Docker Down**: `npm run docker:down` (stops all docker containers)
- **E2E Docker Tests**: `npm run test:e2e:docker` (starts services in Docker and runs E2E tests)
- **Test Report**: `npm run test:report` (view Playwright HTML report)

### Code Quality
- **Lint Code**: `npm run lint` (format check + js lint)
- **Fix Lint Issues**: `npm run fix` (auto-fix format & js issues)
- **Format Code**: `npm run format` (prettier only)

## Code Style Guidelines

- **Formatting**: 2-space indentation, single quotes, semicolons, 100-char line width
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Imports**: Group by builtin → external → internal → relatives, alphabetize
- **JavaScript**: Modern ES6+ modules (import/export), avoid CommonJS except in config files
- **Error Handling**: Use try/catch blocks, prefer promise rejection with Error objects
- **Type Safety**: Use JSDoc comments for documenting types
- **Structure**: Monorepo using npm workspaces with packages for frontend, backend, e2e-tests
- **Security**: Follow security best practices, no hardcoded secrets, validate user inputs
- **Testing**: Write comprehensive tests, maintain test coverage

## Project Architecture

- **Frontend**: Vanilla JavaScript, no framework
- **Backend**: Node.js with Express, PostgreSQL database
- **Authentication**: JWT-based auth with login/registration flows
- **Deployment**: Docker containers with Docker Compose for local dev/testing
- **E2E Tests**: Playwright using Page Objects pattern
- **Quiz Logic**: Spaced repetition algorithm with word mastery levels

## E2E Testing Guidelines

- **ALWAYS use constants for timeouts** - All timeouts must use constants from `utils/timeouts.js` or `utils/constants.js`
- **Keep timeouts short** - Only heavy data downloads can take up to 5 seconds, everything else should be 1 second or less
- **Use proper reporting** - Use HTML reporter with `open: 'never'` to prevent process blocking
- **Prefer fast test mode** - Always use fast test mode with `E2E_FAST_QUIZ=true` for quicker test iterations during development and debugging
- **Check all related logs** - Before providing a fix, always check console logs, API responses, and all related source code
- **Debug data flow completely** - When debugging data-related issues, trace the full flow from API calls to front-end rendering

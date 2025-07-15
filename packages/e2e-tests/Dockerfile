FROM mcr.microsoft.com/playwright:v1.54.1-jammy

# Install additional dependencies for WebKit and Firefox
RUN apt-get update && apt-get install -y \
    # Dependencies for WebKit
    libwoff1 \
    libopus0 \
    libwebp7 \
    libwebpdemux2 \
    libharfbuzz-icu0 \
    # Dependencies for Firefox
    libgtk-3-0 \
    libdbus-glib-1-2 \
    libxt6 \
    # General browser dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy core package first (needed for dependency resolution)
COPY packages/core/package*.json ./packages/core/
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/core/src/ ./packages/core/src/

# Copy e2e-tests package files
COPY packages/e2e-tests/package*.json ./packages/e2e-tests/
COPY packages/e2e-tests/tsconfig.json ./packages/e2e-tests/

# Install dependencies in the correct order
WORKDIR /app/packages/core
RUN npm install

# Build core package to generate type declarations
RUN npm run build

# Install e2e-tests dependencies
WORKDIR /app/packages/e2e-tests
RUN npm install

# Copy all e2e test files
COPY packages/e2e-tests/ .

# Install playwright browsers
RUN npx playwright install-deps
RUN npx playwright install

# Verify TypeScript compilation works
RUN npm run typecheck

# Make playwright available in PATH
ENV PATH="/app/packages/e2e-tests/node_modules/.bin:${PATH}"

# Default command runs all tests
CMD ["npx", "playwright", "test"]

FROM mcr.microsoft.com/playwright:v1.52.0-jammy

WORKDIR /app

# Copy package.json files first for better layer caching
COPY package*.json ./
COPY packages/e2e-tests/package*.json ./packages/e2e-tests/

# Install dependencies and Playwright browsers
RUN npm ci \
  &&
  # Install Playwright browsers correctly
  npx playwright install --with-deps chromium firefox webkit \
  &&
  # Make sure to create required directories
  mkdir -p /app/packages/e2e-tests/test-results /app/packages/e2e-tests/playwright-report

# Copy the rest of the application
COPY . .

# Update PATH to include node_modules bin directory
ENV PATH="/app/node_modules/.bin:${PATH}"

# Set working directory to e2e-tests
WORKDIR /app/packages/e2e-tests

# Default command to run tests with npx
CMD ["npx", "playwright", "test"]

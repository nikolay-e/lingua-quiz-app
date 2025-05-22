# syntax=docker/dockerfile:1.4
FROM node:20-alpine as base

WORKDIR /app

# First stage: Install dependencies
FROM base as dependencies
# Copy package.json files
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/

# Install all dependencies (including dev) for potential build steps
RUN npm ci

# Second stage: Prune dependencies if needed
FROM dependencies as pruned-dependencies
# Keep only production dependencies
RUN npm prune --production
# Ensure directory structure exists
RUN mkdir -p packages/backend

# Final stage
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN apk add --no-cache curl postgresql-client

# Copy root package.json and backend package.json
COPY package.json ./
COPY packages/backend/package.json ./packages/backend/

# Copy only production dependencies
COPY --from=pruned-dependencies /app/node_modules ./node_modules

# Copy backend source code
COPY packages/backend/src ./packages/backend/src
COPY packages/backend/migrations ./packages/backend/migrations

# Set proper ownership
RUN chown -R appuser:appgroup /app

USER appuser

# Add health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:9000/api/health || exit 1

# Set environment variables
ENV NODE_ENV=production
EXPOSE 9000

# Start the server
CMD ["node", "packages/backend/src/server.js"]

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY package.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies for the workspace
RUN npm install

# Copy core package source
COPY packages/core/ ./packages/core/

# Copy frontend source
COPY packages/frontend/ ./packages/frontend/

# Build core package first
WORKDIR /app/packages/core
RUN npm run build

# Build frontend
WORKDIR /app/packages/frontend
RUN npm run build

# Production stage
FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# Copy built files from builder stage
COPY --from=builder /app/packages/frontend/dist .

# Custom nginx config to handle SPA routing
RUN echo "server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files \$uri \$uri/ /index.html; \
    } \
}" > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
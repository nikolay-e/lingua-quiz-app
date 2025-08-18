# Build stage
FROM node:24-alpine AS builder

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

# Custom nginx config to handle SPA routing and security headers
RUN echo "server { \
    listen 80; \
    \
    # Security headers \
    add_header X-Frame-Options \"DENY\" always; \
    add_header X-Content-Type-Options \"nosniff\" always; \
    add_header X-XSS-Protection \"1; mode=block\" always; \
    add_header Referrer-Policy \"strict-origin-when-cross-origin\" always; \
    add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always; \
    add_header Permissions-Policy \"geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()\" always; \
    add_header Cross-Origin-Embedder-Policy \"credentialless\" always; \
    add_header Cross-Origin-Opener-Policy \"same-origin\" always; \
    \
    # Content Security Policy \
    add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' http://localhost:9000 http://backend:9000 https://lingua-quiz.nikolay-eremeev.com https://test-lingua-quiz.nikolay-eremeev.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';\" always; \
    \
    # Static asset caching \
    location ~* \\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ { \
        root /usr/share/nginx/html; \
        expires 1y; \
        add_header Cache-Control \"public, immutable\"; \
        add_header X-Content-Type-Options \"nosniff\" always; \
    } \
    \
    # HTML files - no caching \
    location ~* \\\.(html)\$ { \
        root /usr/share/nginx/html; \
        expires -1; \
        add_header Cache-Control \"no-cache, no-store, must-revalidate\"; \
        add_header Pragma \"no-cache\"; \
        add_header X-Content-Type-Options \"nosniff\" always; \
    } \
    \
    # SPA routing \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files \$uri \$uri/ /index.html; \
        \
        # No caching for the main HTML file \
        expires -1; \
        add_header Cache-Control \"no-cache, no-store, must-revalidate\"; \
        add_header Pragma \"no-cache\"; \
    } \
    \
    # Security - hide server info \
    server_tokens off; \
}" > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

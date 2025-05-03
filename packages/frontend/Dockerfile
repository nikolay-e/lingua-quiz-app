# Stage 1: Build static assets with proper build process
FROM node:16-alpine as builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set up working directory
WORKDIR /app

# First copy package files for better layer caching
COPY package*.json ./

# Install dependencies including dev dependencies for build
RUN npm install

# Copy all frontend source files
COPY . .

# Create a build directory
RUN mkdir -p dist

# Build the frontend using our npm script
RUN npm run build

# Add a version file with timestamp to bust cache
RUN echo "Build date: $(date)" > dist/version.txt

# Stage 2: Serve static files with Nginx
FROM nginx:alpine

# Copy from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

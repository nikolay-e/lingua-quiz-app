FROM node:22.14.0-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY server.js .
COPY runMigrations.js .
COPY migrations ./migrations

EXPOSE 443

CMD ["node", "server.js"]

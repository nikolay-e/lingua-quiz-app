FROM node:22.15.1-alpine3.21 as dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/

RUN npm ci

FROM node:22.15.1-alpine3.21 as production-build

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend .

RUN npm prune --omit=dev

FROM node:22.15.1-alpine3.21

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN apk add --no-cache curl

COPY --from=production-build /app/node_modules ./node_modules
COPY --from=production-build /app .

RUN chown -R appuser:appgroup /app

USER appuser

CMD ["node", "server.js"]

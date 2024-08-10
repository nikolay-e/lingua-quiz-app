FROM node:alpine as builder

RUN apk add --no-cache ca-certificates

WORKDIR /site
COPY package*.json ./
RUN npm install

COPY . .

ARG BUILD_ENV
RUN if [ "$BUILD_ENV" = "prod" ]; then \
        npm run build:prod; \
    else \
        npm run build:dev; \
    fi

FROM nginx:alpine

COPY --from=builder /site/dist /usr/share/nginx/html

RUN mkdir -p /etc/nginx/ssl

COPY nginx.conf.template /etc/nginx/nginx.conf.template

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]

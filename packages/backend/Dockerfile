FROM node:22.8

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY server.js .
COPY run-migrations.js .
COPY migrations ./migrations

EXPOSE 443

CMD ["node", "server.js"]

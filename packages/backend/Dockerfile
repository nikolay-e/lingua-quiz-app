FROM node:14

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY server.js .
COPY run-migrations.js .
COPY migrations ./migrations

EXPOSE 3000

CMD ["node", "server.js"]
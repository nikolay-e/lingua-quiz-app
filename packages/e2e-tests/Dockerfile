FROM mcr.microsoft.com/playwright:v1.47.2-jammy

WORKDIR /app

COPY package*.json ./

COPY . .

RUN npm ci

CMD ["npm", "run", "test", "--reporter=list,null"]

FROM node:alpine as builder

RUN apk add --no-cache ca-certificates

WORKDIR /site
COPY package*.json ./
RUN npm install

COPY ./src ./dist

FROM nginx:alpine

COPY --from=builder /site/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

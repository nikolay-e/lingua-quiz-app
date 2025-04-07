FROM postgres:13-alpine

RUN apk add --no-cache ca-certificates curl

RUN curl -sSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
  && chmod +x /usr/local/bin/mc

RUN mc --version

RUN mkdir /backup && chown postgres:postgres /backup

USER postgres

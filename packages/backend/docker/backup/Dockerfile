# packages/backend/docker/backup/Dockerfile
# Используем официальный образ PostgreSQL, чтобы иметь pg_dump нужной версии
FROM postgres:13-alpine

# Устанавливаем ca-certificates (важно для HTTPS к Spaces) и curl (для скачивания mc)
RUN apk add --no-cache ca-certificates curl

# Скачиваем и устанавливаем MinIO Client (mc)
RUN curl -sSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /usr/local/bin/mc \
  && chmod +x /usr/local/bin/mc

# Проверяем установку mc (опционально)
RUN mc --version

# Директория для временного хранения бэкапа внутри контейнера
RUN mkdir /backup && chown postgres:postgres /backup

# Переключаемся на пользователя postgres для выполнения pg_dump
USER postgres

# Точка входа не нужна, т.к. команду будем задавать в CronJob

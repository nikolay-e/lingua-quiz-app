# Этап установки зависимостей
FROM node:22.14.0-alpine3.21 as dependencies

WORKDIR /app

# Копируем корневые package.json и package-lock.json
COPY package.json package-lock.json ./

# Копируем package.json ИЗ воркспейса backend
COPY packages/backend/package.json ./packages/backend/

# Важно: Устанавливаем зависимости из корневого каталога,
# чтобы npm правильно обработал воркспейсы.
# Здесь все еще можно использовать --omit=dev, но давайте сначала
# запустим полный 'npm ci', а затем удалим devDependencies через prune,
# это часто более надежно с воркспейсами.
RUN npm ci

# --- Этап сборки production-образа ---
FROM node:22.14.0-alpine3.21 as production-build

WORKDIR /app

# Копируем ТОЛЬКО production зависимости из предыдущего этапа
# и package.json/package-lock.json для команды prune
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/backend/package.json ./packages/backend/

# Копируем исходный код backend
COPY packages/backend .

# Удаляем devDependencies (npm prune --production удаляет лишнее из node_modules)
RUN npm prune --production

# --- Финальный этап ---
FROM node:22.14.0-alpine3.21

WORKDIR /app

# Создаем пользователя и группу
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Копируем очищенные node_modules и код из production-build этапа
COPY --from=production-build /app/node_modules ./node_modules
COPY --from=production-build /app .

# Устанавливаем владельца
RUN chown -R appuser:appgroup /app

# Переключаемся на пользователя
USER appuser

# Команда запуска (теперь из корня /app, так как мы скопировали туда backend)
CMD ["node", "server.js"]
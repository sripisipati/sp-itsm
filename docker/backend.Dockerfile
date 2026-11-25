FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY database/package.json database/package.json
COPY e2e/package.json e2e/package.json
RUN npm ci
COPY database database
COPY backend backend
COPY docker/backend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && npm run db:generate \
  && npm run build -w @itsm/backend
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]

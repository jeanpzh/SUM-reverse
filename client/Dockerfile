FROM node:24-bookworm-slim AS build
RUN npm install --global pnpm@12.10.1
WORKDIR /app/client
COPY client/package.json client/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY client/index.html client/vite.config.ts client/tsconfig*.json ./
COPY client/src ./src
COPY client/public ./public
COPY shared /app/shared
COPY raw-types /app/raw-types
ENV VITE_SUM_DATA_MODE=local VITE_SUM_API_BASE_URL=/api
RUN pnpm build

FROM nginx:stable-alpine AS runtime
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 8080

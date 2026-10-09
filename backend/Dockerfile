FROM node:24-bookworm-slim AS build
RUN npm install --global pnpm@12.10.1
WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/nest-cli.json backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
COPY shared /app/shared
RUN pnpm build && pnpm prune --prod

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app/backend
COPY --from=build --chown=node:node /app/backend/package.json ./package.json
COPY --from=build --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --from=build --chown=node:node /app/shared /app/shared
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]

# Production image of the API (PLAN.md Phase 18). Built on the developer's
# machine for linux/arm64 by deploy/scripts/build-images.sh; the server only
# runs it. The same image applies the database migrations (`migrate` service).

FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# postinstall runs `prisma generate`, which needs the schema.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:26-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
# Production dependencies, plus the Prisma CLI for `prisma migrate deploy`.
# The project's postinstall is skipped (the client is already generated into
# dist/); only the Prisma engines' own install step runs.
RUN npm ci --omit=dev --ignore-scripts \
  && npm install --no-save --omit=dev --ignore-scripts \
    "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
  && npm rebuild prisma @prisma/engines \
  && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 3000
CMD ["node", "dist/main"]

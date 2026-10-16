# Production web image (PLAN.md Phase 18): the React build served by Nginx,
# which also passes /api to the backend. Built from the repository root by
# deploy/scripts/build-images.sh; no development server runs in production.

FROM node:26-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Every VITE_ value is embedded in the public build: never a secret.
ARG VITE_DEMO_ENABLED=true
ENV VITE_DEMO_ENABLED=$VITE_DEMO_ENABLED
# Type checking runs with the tests (`npm run build` also checks the tests,
# which read backend/openapi.json from outside this image).
RUN npx vite build

FROM nginx:1.29-alpine
# The site is chosen at start: HTTPS once the certificate exists, otherwise
# a plain-HTTP placeholder that lets the first certificate be issued.
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/web/nginx.conf /etc/nginx/nginx.conf
COPY deploy/web/snippets/ /etc/nginx/snippets/
COPY deploy/web/sites/ /etc/nginx/sites/
COPY --chmod=755 deploy/web/40-choose-site.sh /docker-entrypoint.d/
COPY --from=build /app/dist /usr/share/nginx/html

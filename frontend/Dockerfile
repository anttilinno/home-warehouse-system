# ---- Build (Vite static SPA) ----
FROM oven/bun:1.3.5 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . .
# vite build → dist/. prebuild runs the forbidden-imports gate; build runs tsc -b
# then vite build (sourcemaps off in prod per vite.config).
RUN bun run build

# ---- Serve (static SPA on :3000 behind Angie) ----
# Angie owns /api/* → backend and the s.go shortlink; this container only serves
# the built SPA with an index.html history fallback. Port 3000 keeps the Angie
# `frontend` upstream + healthcheck unchanged after retiring frontend1.
FROM nginx:1.27-alpine AS runner
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000

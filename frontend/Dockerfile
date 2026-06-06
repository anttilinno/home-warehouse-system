# ---- Dependencies ----
FROM oven/bun:1.3.5 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

# ---- Builder ----
FROM oven/bun:1.3.5 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Empty string = relative URLs (proxied through Angie)
ENV NEXT_PUBLIC_API_URL=""
ENV NEXT_TELEMETRY_DISABLED=1
ENV SERWIST_SUPPRESS_TURBOPACK_WARNING=1

# Authelia SSO button. Build-time gate (Next inlines NEXT_PUBLIC_* at build):
# defaults off; deployers pass --build-arg NEXT_PUBLIC_AUTHELIA_ENABLED=true.
ARG NEXT_PUBLIC_AUTHELIA_ENABLED=false
ENV NEXT_PUBLIC_AUTHELIA_ENABLED=${NEXT_PUBLIC_AUTHELIA_ENABLED}

RUN bun run build

# ---- Runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public

USER app

EXPOSE 3000

CMD ["node", "server.js"]

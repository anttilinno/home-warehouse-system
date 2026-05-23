# ---- Builder ----
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache build-base libwebp-dev

WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY . .

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 go build -ldflags="-s -w" -o /bin/server    ./cmd/server && \
    CGO_ENABLED=1 go build -ldflags="-s -w" -o /bin/worker    ./cmd/worker && \
    CGO_ENABLED=1 go build -ldflags="-s -w" -o /bin/scheduler ./cmd/scheduler

# ---- Runtime ----
FROM alpine:3.22

RUN apk add --no-cache libwebp ca-certificates tzdata \
    && addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /bin/server   ./server
COPY --from=builder /bin/worker   ./worker
COPY --from=builder /bin/scheduler ./scheduler

RUN mkdir -p /data/photos && chown -R app:app /app /data/photos

USER app

EXPOSE 8080

CMD ["./server"]

# ---- Migrate ----
# Separate image, built only via `--target migrate`. Carries dbmate + the
# migration SQL so the migrate Job can run them. Deliberately NOT part of the
# app runtime above: keeping dbmate (a destructive DB tool) and the schema out
# of long-lived app pods limits blast radius if an app pod is compromised.
FROM ghcr.io/amacneil/dbmate:2 AS migrate
COPY db/migrations /db/migrations

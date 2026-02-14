---
phase: 42-reverse-proxy-and-end-to-end-validation
plan: 01
status: complete
commit: 31d9aeae
---

# Plan 42-01 Summary: Harden SSE proxy settings and add Angie healthcheck

## What Changed

1. **SSE proxy hardening** (`docker/angie/angie.conf`):
   - Added `proxy_http_version 1.1` to /workspaces/ block (required for keepalive to upstream)
   - Added `proxy_set_header Connection ""` to clear hop-by-hop header (critical for SSE)
   - Added `proxy_cache off` to prevent caching of SSE streams
   - Added `keepalive 16` to backend upstream for connection reuse

2. **Angie healthcheck** (`docker-compose.yml`):
   - Added healthcheck: `curl -fsk https://localhost/health` validates full proxy chain
   - 10s interval, 5s timeout, 3 retries, 5s start period

## Verification

- `docker compose --profile prod config --quiet` validates successfully
- All SSE directives present in /workspaces/ location block
- Healthcheck added to angie service definition

## Decisions

- Used curl (available in Angie's Debian-based image) for healthcheck
- `-fsk` flags: fail on HTTP errors, silent output, skip cert verification (self-signed)

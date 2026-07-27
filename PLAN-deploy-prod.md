# Deploy Roadmap: Push Current Changes to Homelab Prod

Runbook for shipping `master` (currently: Rapid Capture, Location Photos,
short-code resolution — merge `8a4e7016`) to the homelab. No CD workflow
exists (`.github/workflows/` is test/lint/security only); deploy is manual,
via `docker-compose.yml`'s `prod` profile on the homelab host. `deploy-to-k3s.sh`
was removed (commit `74dd0f99`) — k3s is NOT the current target, plain
`docker compose --profile prod` is.

## What's shipping

- `/capture` mobile rapid-entry loop (scan → optional photo → save → next)
- Location photos (`warehouse.location_photos`, migration `010`)
- Global short-code registry resolving items/locations/containers + QR
  redirect fix (was emitting stale v2.1 `/{locale}/dashboard/...` paths)

## Pre-deploy checklist

- [ ] `master` CI green: `test-backend`, `e2e-frontend`, `lint-frontend`,
      `security-backend` all passed on `8a4e7016` (or whatever HEAD is at
      deploy time). **As of the 2026-07-27 debt session, `master` as pushed
      could NOT build the frontend image** — `tsc -b` failed with 12 errors and
      the Dockerfile runs `bunx tsc -b && bunx vite build`. The fix is in the
      working tree, not yet committed; commit it before deploying or step 3
      fails. `lint-frontend` was also red on a stale grep-guard self-test (same
      fix set).
- [ ] **Verify the homelab's live `docker-compose.yml` env values before
      overwriting it with a `git pull`.** The tracked file hardcodes
      `JWT_SECRET: "change-me-in-production"`, `APP_URL`/`BACKEND_URL:
      "http://localhost"` as literals in the `backend`/`worker`/`scheduler`
      blocks — NOT `${VAR}` substitution, so a host-side `.env` file does not
      reach them. If the homelab runs a real domain + real secret, that only
      works if the live copy on the host has been hand-edited to diverge from
      what's in git. `diff` the host's file against `git show HEAD:docker-compose.yml`
      before pulling; do not let a plain `git pull` silently revert those
      values back to the insecure placeholders.
- [ ] Back up `postgres-prod` volume (`./.data/postgres-prod`) before running
      migrations. Migration `010` is defensive (checks for
      `uq_locations_ws_id`/`uq_files_ws_id` before adding, handles DBs
      restored from older dumps) but any first-time-since-`002` jump is worth
      a snapshot first regardless.
- [ ] Confirm DNS for the `s.go` shortlink vhost still resolves to this host
      (Angie's `s.go` server block is unchanged by this release, but the
      resolver behind it changed — worth a live check post-deploy, see below).

## Deploy steps

1. On the homelab host: `git fetch && git diff HEAD origin/master -- docker-compose.yml`
   — confirm no unexpected changes to the file you're about to inherit.
2. `git pull`
3. `docker compose --profile prod build backend worker scheduler frontend`
4. `docker compose --profile prod up -d` — `migrate` (dbmate, one-shot) runs
   automatically and blocks `backend`/`worker`/`scheduler` via
   `depends_on: condition: service_completed_successfully`. Watch its logs:
   `docker compose logs migrate` — should show `010_location_photos.sql`
   applying cleanly.
5. **Recreate Angie** — `docker compose --profile prod up -d --force-recreate angie`.
   `docker/angie/proxy_params.conf` is a read-only bind mount, so a running
   container keeps serving the OLD config; a plain `up -d` with no image change
   will not restart it. This release changes that file and the change is a
   **security fix**: `X-Forwarded-For` is now overwritten with the real peer
   instead of appended to the client's value, and `True-Client-IP` is cleared.
   Until Angie picks it up, the auth rate limiter is bypassable by rotating
   either header (chi's `middleware.RealIP` trusts both and feeds `RemoteAddr`,
   which is the limiter's only key).
6. `docker compose --profile prod ps` — confirm `backend` and `frontend`
   healthchecks go healthy (Angie depends on both).
7. Smoke test against the real domain:
   - Log in, load dashboard.
   - `/capture`: scan a label, confirm save + counter advance.
   - Location edit dialog: upload a photo, confirm it renders.
   - Scan a printed `s.go/<code>` QR (or hit `/r/{code}` directly) for an
     item, a location, and a container — confirm each resolves and lands on
     the right page (this is the regression the release fixes: previously
     any QR resolve 404'd via a stale locale-prefixed redirect path).
   - Header sanitisation: `curl -H 'True-Client-IP: 1.2.3.4' https://<host>/health`
     then check the backend log line for that request — it must show the real
     client IP, not `1.2.3.4`. Same with `-H 'X-Forwarded-For: 1.2.3.4'`.

## Rollback

- `docker compose --profile prod down` on `backend`/`worker`/`scheduler`/`frontend`,
  `git checkout <previous-good-sha>`, rebuild, `up -d` again.
- Migration `010`'s `migrate:down` only drops `warehouse.location_photos` —
  it does NOT remove the `uq_locations_ws_id`/`uq_files_ws_id` constraints it
  may have added defensively (other FKs — `containers_location_fk`,
  `favorites_location_fk` — depend on the same key). A rollback that runs
  `dbmate rollback` is safe; nothing downstream breaks from those
  constraints existing.

## Known gaps shipping with this release (not blockers, just watch-items)

From `.planning/ROADMAP.md` "Known gaps" (2026-07-27) — nothing here blocks
the deploy, each has a named ceiling:

- A photo can be lost (silently) if the device reloads mid-offline-queue —
  the capture itself still replays and creates the item.
- Scanning the same label twice while offline queues two creates; the
  duplicate resolves to one row + a conflict toast on drain.
- No orphan cleanup for `warehouse.files` rows after a location-photo delete.
- `warehouse_dev` (LOCAL dev DB only, not prod) sits at migration `002` —
  irrelevant to this deploy, but if you reuse that DB for anything, run
  `dbmate up` first.

## Out of scope for this deploy

- **Backend MCP Server (stdio-over-SSH)** — scaffolded (`backend/cmd/mcp/`),
  read-only tools + tests exist, but homelab deploy + SSH forced-command key
  + workstation config are still pending per `PLAN-mcp-ssh.md`. Ships
  separately.

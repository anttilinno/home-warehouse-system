# PLAN — Backend MCP over stdio-via-SSH

Expose the warehouse backend to an MCP client (Claude Code / Desktop) on a
workstation, while the server runs on the homelab. Transport is **stdio wrapped
in SSH** — no public MCP endpoint, no new network auth to design, SSH is the
trust boundary.

## Goal

From the workstation, an agent can query and mutate warehouse data (items,
containers, inventory, loans, search) through MCP tools. The homelab backend
stays reachable only over SSH/tailnet.

## Architecture

```
workstation                          homelab
-----------                          -------
MCP client  ──spawns──▶ ssh homelab warehouse-mcp
(Claude)                             │  (stdio MCP server, new cmd/mcp)
   ▲  stdio over the SSH pipe        │
   └────────────────────────────────┤  HTTP (Bearer JWT) to localhost:8080
                                     ▼
                             existing Go server  ──▶ Postgres
                             (already running)
```

The MCP server is a **thin HTTP client** to the running backend, not a second
copy of the service layer. It reuses the live server's validation, auth,
workspace-scoping, and huma-generated REST shapes. Nothing to keep in sync.

## Approach decision

**Chosen: B1 — MCP server is an HTTP client to `localhost:8080`.**

- Backend is already up on the homelab serving REST. MCP just translates
  MCP tool calls → REST calls. ~0 business logic.
- `internal/api/router.go` wires 37 services in one ~130-line block
  (`NewRouter`, lines ~181–310). Re-wiring that in a new `cmd` = duplication
  that will drift. B1 avoids it entirely.
- Couples only to the REST contract, which huma documents via OpenAPI and is
  the most stable surface in the codebase.

**Rejected (for now): B2 — MCP re-wires DB pool + services directly.**
Removes the HTTP hop and the need for a token, but duplicates the NewRouter
wiring (or forces a refactor extracting it into `internal/app/BuildServices`).
Only worth it if you want MCP to run *without* the main server up. Revisit if
that becomes a requirement.

## Auth (confirmed against code)

- `internal/api/middleware/auth.go:78` `extractToken` accepts
  `Authorization: Bearer <jwt>` (not only the cookie). Non-browser client works.
- `internal/api/middleware/csrf.go:33` skips CSRF when a Bearer header is
  present. API path is clean — no CSRF token dance.

MCP server auth flow:
1. On startup, POST `/auth/login` with service-account creds from env
   (`WAREHOUSE_MCP_USER` / `WAREHOUSE_MCP_PASS`) — same contract the E2E specs
   already exercise.
2. Hold the returned `access_token`; send it as `Authorization: Bearer` on
   every call.
3. On `401`, re-login (or use the refresh token) once and retry. Keep it dumb —
   single retry, no token cache file.

Workspace: single `WAREHOUSE_MCP_WORKSPACE_ID` env var for the first cut (paths
are `/api/workspaces/{id}/...`). Promote to a per-tool arg only if you actually
use multiple workspaces.

## Transport / SSH

Client spawns the server over SSH; the server speaks plain stdio MCP:

```jsonc
// workstation: Claude Code mcpServers / Claude Desktop config
{
  "warehouse": {
    "command": "ssh",
    "args": ["homelab", "warehouse-mcp"]
  }
}
```

Harden on the homelab with a forced command in `~/.ssh/authorized_keys` so that
key can ONLY launch the MCP server, nothing else:

```
command="/usr/local/bin/warehouse-mcp",no-port-forwarding,no-pty ssh-ed25519 AAAA... mcp-workstation
```

Creds (`WAREHOUSE_MCP_*`) live in the server's environment on the homelab
(systemd drop-in, or an env file the forced command sources) — never passed
from the workstation.

## Tool set — first cut

Map to existing `item.Service` / `container` / `inventory` methods via REST.
Start read-heavy, add the obvious mutations:

| MCP tool                | REST call                                        |
|-------------------------|--------------------------------------------------|
| `item_search`           | `GET  /items?search=` (item.Service.Search)      |
| `item_get`              | `GET  /items/{id}`                               |
| `item_lookup_barcode`   | `GET  /items/by-barcode/{code}`                  |
| `item_list`             | `GET  /items` (paginated)                        |
| `item_create`           | `POST /items`                                    |
| `item_update`           | `PATCH /items/{id}`                              |
| `container_list`        | `GET  /containers`                               |
| `inventory_move`        | `POST /inventory/...` (movement)                 |

Each tool = a JSON-schema input struct + one HTTP call + return the JSON body.
No transformation beyond shaping errors into MCP errors.

## Files to add

```
backend/cmd/mcp/main.go        # stdio MCP server: login, register tools, serve
backend/internal/mcp/client.go # tiny HTTP client: login, refresh-on-401, do()
backend/internal/mcp/tools.go  # tool defs → client calls (grows per table above)
```

Dependency: `github.com/modelcontextprotocol/go-sdk` (official) — or
`github.com/mark3labs/mcp-go` if the official SDK's stdio API is heavier than
needed. One `go get`, no other new deps.

## Build / deploy

- `go build -o warehouse-mcp ./cmd/mcp` on the homelab (or cross-build + scp).
- Add a `mise` task `mcp` mirroring the existing `server`/`worker`/`scheduler`
  tasks for local runs.
- No systemd *service* needed — the process is spawned per SSH session and dies
  with it. (Add a socket-activated unit only if you later want it always-warm.)

## Security

- MCP endpoint is never network-exposed; SSH forced command is the only entry.
- Bearer creds live server-side only.
- MCP tools inherit the backend's existing per-workspace authorization — the
  service account sees exactly what that user sees, nothing more.
- Do NOT add an HTTP/SSE MCP transport until a client that can't SSH needs it;
  that path reopens the auth/TLS/exposure questions this design sidesteps.

## Steps

1. `internal/mcp/client.go` — login + Bearer + one `do(method, path, body)`
   helper with single-retry-on-401. Unit test: 401 → re-login → success.
2. `internal/mcp/tools.go` — `item_search`, `item_get`, `item_lookup_barcode`
   first (read-only, safe to dogfood).
3. `cmd/mcp/main.go` — construct client from env, register tools, `ServeStdio`.
4. Local smoke: `WAREHOUSE_MCP_* ... go run ./cmd/mcp` piped to an MCP inspector.
5. Deploy binary to homelab, add SSH forced-command key.
6. Workstation `mcpServers` config → test `item_search` end to end.
7. Add mutations (`item_create`, `item_update`, `inventory_move`) once reads are
   trusted.

## Skipped (add when)

- **Write tools** — land reads first, add mutations after dogfooding. (Step 7.)
- **Multi-workspace arg** — single env workspace until you run more than one.
- **Token cache / long-lived PAT** — login-on-start is fine; add a PAT issuer
  only if login latency per session annoys you.
- **HTTP/SSE MCP transport** — only when a non-SSH client appears.
- **B2 direct-service wiring** — only if MCP must run without the main server.

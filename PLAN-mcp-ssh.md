# Backend MCP over stdio-via-SSH

Exposes the warehouse backend to an MCP client (Claude Code / Desktop) on a
workstation while the server runs on the homelab. Transport is **stdio wrapped
in SSH** — no public MCP endpoint, no new network auth to design, SSH is the
trust boundary.

Status: **shipped and smoke-verified 2026-07-29.** This document describes what
runs. The original design notes are preserved under "Design decisions" and
"What changed from the plan" at the bottom.

## Architecture

```
workstation                            homelab (k3s-01)
-----------                            ----------------
MCP client ──ssh──▶ kubectl exec -i ──▶ warehouse-mcp   (stdio MCP server)
(Claude)                                    │
   ▲  stdio over the SSH pipe               │  HTTP (Bearer JWT)
   └────────────────────────────────────────┤  to http://backend:8080
                                            ▼
                                    existing Go backend ──▶ Postgres
                                    (already running)
```

The MCP server is a **thin HTTP client** to the running backend, not a second
copy of the service layer. It reuses the live server's validation, auth,
workspace scoping, and huma-generated REST shapes. Nothing to keep in sync.

## What runs

**Workstation** — `.mcp.json` at the repo root (committed):

```jsonc
{
  "mcpServers": {
    "warehouse": {
      "command": "ssh",
      "args": [
        "debian@192.168.10.10",
        "sudo k3s kubectl -n warehouse exec -i deploy/warehouse-mcp -- warehouse-mcp"
      ]
    }
  }
}
```

No secrets here: the credentials live server-side and never leave the cluster.
It does hardcode the homelab address, so it only works from a machine on that
network.

**Homelab** — a `warehouse-mcp` Deployment in namespace `warehouse`, running the
same `git.lan/antti/warehouse-backend` image as the other four workloads:

- `command: ["tail", "-f", "/dev/null"]` — the pod is a parked idle host, not a
  server. Nothing listens; each `kubectl exec` spawns its own short-lived
  `warehouse-mcp` process on that session's stdio and it dies with the session.
- `/usr/local/bin/warehouse-mcp` is on PATH in the image (backend Dockerfile),
  so the exec command is just the binary name.
- `WAREHOUSE_MCP_URL: http://backend:8080` (in-cluster Service DNS).
- `envFrom` the `warehouse-mcp-secrets` Secret, which carries
  `WAREHOUSE_MCP_USER`, `WAREHOUSE_MCP_PASS`, `WAREHOUSE_MCP_WORKSPACE_ID`.
  `cmd/mcp/main.go` refuses to start if any of the three is unset.
- Requests 10m CPU / 32Mi, limit 128Mi. It idles at ~nothing between sessions.

Deployment is via the fleet/GitOps repo (Flux), like the rest of the namespace —
see the deploy notes for that workflow.

## Auth

- `internal/api/middleware/auth.go` `extractToken` accepts
  `Authorization: Bearer <jwt>`, not only the cookie, so a non-browser client
  works.
- `internal/api/middleware/csrf.go` skips CSRF when a Bearer header is present —
  no CSRF token dance on the API path.

Flow: POST `/auth/login` with the service-account creds from env on startup,
hold the returned `access_token`, send it as `Authorization: Bearer` on every
call, and on a `401` re-login once and retry. Deliberately dumb — single retry,
no token cache file. Login latency is per session, and a session is a whole
Claude conversation.

Workspace is a single `WAREHOUSE_MCP_WORKSPACE_ID`; promote it to a per-tool
argument only if more than one workspace is ever in play.

## Tools

Six, all in `internal/mcp/tools.go`, each a JSON-schema input struct plus one
HTTP call returning the response body. No transformation beyond shaping errors
into MCP errors.

| MCP tool              | REST call                        |
|-----------------------|----------------------------------|
| `item_search`         | `GET /items?search=`             |
| `item_get`            | `GET /items/{id}`                |
| `item_lookup_barcode` | `GET /items/by-barcode/{code}`   |
| `item_create`         | `POST /items`                    |
| `item_update`         | `PATCH /items/{id}`              |
| `inventory_move`      | `POST /inventory/{id}/move`      |

Not built, because nothing asked for them: `item_list` (paginated) and
`container_list`.

## Files

```
backend/cmd/mcp/main.go        # stdio MCP server: env, login, register tools, serve
backend/internal/mcp/client.go # HTTP client: login, re-login-on-401, do()
backend/internal/mcp/tools.go  # the six tool defs
```

Dependency: `github.com/modelcontextprotocol/go-sdk` (official) v1.6.1. One
`go get`, no others. `mise run mcp` runs it locally; `mise run build-mcp`
cross-builds the binary.

## Security

- The MCP endpoint is never network-exposed. Reaching it requires SSH to the
  homelab AND permission to `kubectl exec` in the `warehouse` namespace.
- Bearer credentials live in a cluster Secret, server-side only. The workstation
  config holds none.
- Tools inherit the backend's per-workspace authorization: the service account
  sees exactly what that user sees, nothing more.
- Do NOT add an HTTP/SSE MCP transport until a client that cannot SSH needs one.
  That path reopens every auth/TLS/exposure question this design sidesteps.

## Verification

Smoke-tested 2026-07-29 by piping raw JSON-RPC through the real path
(`ssh … kubectl exec -i … warehouse-mcp`): `initialize` returned
`warehouse 0.1.0`, `tools/list` returned all six with their schemas, and
`tools/call item_search` returned a real workspace-scoped response — which
proves login, Bearer auth, and workspace scoping all work end to end, not just
that the process starts.

Note when re-running by hand: close stdin too early and the server exits on EOF
before the HTTP round trip completes, so the `tools/call` reply never arrives.
Hold the pipe open a few seconds.

## Design decisions

**Chosen: the MCP server is an HTTP client to the backend.** The backend is
already up serving REST, so MCP just translates tool calls into REST calls with
~0 business logic. `internal/api/router.go` wires 37 services in one ~130-line
block; re-doing that in a new `cmd` is duplication that would drift. This
couples only to the REST contract, which huma documents via OpenAPI and is the
most stable surface in the codebase.

**Rejected: MCP re-wires the DB pool and services directly.** Removes the HTTP
hop and the need for a token, but duplicates the `NewRouter` wiring (or forces a
refactor extracting it into `internal/app/BuildServices`). Only worth it if MCP
must run *without* the main server up. Revisit if that becomes a requirement.

## What changed from the plan

- **Transport.** The plan called for a `warehouse-mcp` binary on the host plus an
  SSH `authorized_keys` forced command
  (`command="/usr/local/bin/warehouse-mcp",no-port-forwarding,no-pty …`). The
  app runs in k3s, not on the host, so the binary ships inside the existing
  backend image and is reached with `kubectl exec` into an idle pod. Same
  property — the workstation cannot ask for anything but this one process — with
  no second copy of the binary to deploy or keep in step with the backend.
- **Write tools.** The plan deferred them behind "land reads first, add
  mutations after dogfooding". They shipped in `7490a789` once the read tools
  were trusted, which is exactly what step 7 asked for.
- **Still deferred, as planned:** multi-workspace arg, token cache / long-lived
  PAT, HTTP/SSE transport, and direct-service wiring.

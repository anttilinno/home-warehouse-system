# Authelia Authentication Method

Authelia is the third authentication method, alongside email/password and OAuth
(Google/GitHub). It is a **reverse-proxy forward-auth (SSO)** integration: a
user already authenticated by Authelia at the k3s ingress is transparently
logged into the warehouse app, provisioning a local user on first sight.

It is **disabled by default** and only relevant in deployments that run behind
Authelia.

## How it works

```
browser ──▶ ingress / Authelia ──▶ backend  POST /auth/authelia/login
                   │                          reads Remote-* + secret header
                   │                          → resolve/provision user
                   │                          → mint app JWT cookies
                   ▼
            authenticates user,
            injects Remote-User / Remote-Email / Remote-Name / Remote-Groups
            and X-Authelia-Shared-Secret
```

1. Authelia authenticates the user upstream and injects its standard identity
   headers (`Remote-User`, `Remote-Email`, `Remote-Name`, `Remote-Groups`).
2. The backend maps `Remote-Email` to a local user, creating a passwordless
   user + personal workspace on first login (same provisioning path as OAuth).
3. The backend mints its **own** `access_token` / `refresh_token` JWT cookies
   and records a session. Every other endpoint keeps using the existing
   `JWTAuth` middleware unchanged — Authelia is just a new way to obtain the
   cookies.

## The trust boundary — read before deploying

The Remote-* headers are **plaintext and trivially forgeable**. The backend does
**not** trust them on their own. The trust gate is a shared secret:

- The reverse proxy in front of Authelia injects
  `X-Authelia-Shared-Secret: <AUTHELIA_SHARED_SECRET>` on requests it forwards
  to `/auth/authelia/login`.
- That same proxy **MUST strip any client-supplied `X-Authelia-Shared-Secret`
  and `Remote-*` headers** so a direct client request can never present them.
- The backend compares the header against `AUTHELIA_SHARED_SECRET` in
  constant time; a wrong or missing secret returns `401` and provisions
  nothing.

Why a secret and not a source-IP allowlist: `chi`'s `RealIP` middleware rewrites
`RemoteAddr` from `X-Forwarded-For`, so any IP-based check would itself be
spoofable. The secret does not have that problem.

The backend refuses to start (`config.Validate`) when `AUTHELIA_ENABLED=true`
and `AUTHELIA_SHARED_SECRET` is empty.

## Configuration

| Env var                  | Default | Meaning                                                        |
| ------------------------ | ------- | -------------------------------------------------------------- |
| `AUTHELIA_ENABLED`       | `false` | Mounts `POST /auth/authelia/login` when true.                  |
| `AUTHELIA_SHARED_SECRET` | `""`    | Trust secret; required when enabled. Inject via the ingress.   |

Generate a strong secret, e.g. `openssl rand -hex 32`.

### Example: ingress (Traefik) middleware sketch

```yaml
# After the Authelia forwardAuth middleware has populated Remote-* headers,
# add the shared secret and strip any inbound copy from the client.
http:
  middlewares:
    authelia-secret:
      headers:
        customRequestHeaders:
          X-Authelia-Shared-Secret: "<same value as AUTHELIA_SHARED_SECRET>"
    strip-client-trust-headers:
      headers:
        # Ensure clients cannot smuggle these in:
        customRequestHeaders:
          Remote-User: ""
          Remote-Email: ""
          Remote-Name: ""
          Remote-Groups: ""
          X-Authelia-Shared-Secret: ""
```

Order matters: strip client-supplied trust headers **before** Authelia's
forwardAuth re-populates them, and add the secret on the proxy hop only.

## Endpoint

`POST /auth/authelia/login` (rate-limited, public mount):

- Request: no body; identity comes from the proxy-injected headers above.
- Success: `Set-Cookie: access_token`, `Set-Cookie: refresh_token`, and a JSON
  body `{ "token": ..., "refresh_token": ... }`.
- Failure: `401` (bad/missing secret or no identity), `500` (provisioning or
  token-issue failure).

`Remote-Groups` is logged for audit but does not yet grant roles/superuser —
group-to-role mapping is a deliberate follow-up, not part of this method.

## Frontend

`frontend2` has no login page yet, so there is no "Sign in with Authelia"
button. When a login screen is built, point it at `/api/auth/authelia/login`
behind the Authelia-protected route; the browser request only needs to reach
the endpoint — the ingress supplies the headers.

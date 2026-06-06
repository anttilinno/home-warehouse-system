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
| `AUTHELIA_ENABLED`       | `false` | Mounts `GET`/`POST /auth/authelia/login` when true.           |
| `AUTHELIA_SHARED_SECRET` | `""`    | Trust secret; required when enabled. Inject via the ingress.   |

Frontend (`frontend/`, Next.js):

| Env var                       | Default | Meaning                                                   |
| ----------------------------- | ------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_AUTHELIA_ENABLED`| `false` | Shows the "Authelia SSO" button on the login screen when `true`. Keep in sync with the backend `AUTHELIA_ENABLED`. |

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

## Endpoints

Both are rate-limited public mounts on the same path; the ingress trust rules
(inject secret, strip client copies) **must apply to both methods**.

`GET /auth/authelia/login` — the browser-facing entry point behind the login
button:

- Request: no body; identity comes from the proxy-injected headers above.
- Success: stores a short-lived one-time code and `302`-redirects to
  `${APP_URL}/auth/callback?code=...`. The frontend exchanges that code at
  `POST /auth/oauth/exchange`, which sets the cookies on the app's own origin —
  the same flow OAuth uses, so cookies work cross-origin.
- Failure: `401` (bad/missing secret or no identity); other failures `302` to
  `${APP_URL}/login?oauth_error=server_error`.

`POST /auth/authelia/login` — programmatic/header-exchange callers:

- Request: no body; identity comes from the proxy-injected headers above.
- Success: `Set-Cookie: access_token`, `Set-Cookie: refresh_token`, and a JSON
  body `{ "token": ..., "refresh_token": ... }`.
- Failure: `401` (bad/missing secret or no identity), `500` (provisioning or
  token-issue failure).

`Remote-Groups` is logged for audit but does not yet grant roles/superuser —
group-to-role mapping is a deliberate follow-up, not part of this method.

## Frontend

The login screen lives in `frontend/` (Next.js). When
`NEXT_PUBLIC_AUTHELIA_ENABLED=true`, an "Authelia SSO" button appears beside the
Google/GitHub buttons and full-page-redirects to
`${NEXT_PUBLIC_API_URL}/auth/authelia/login`. That path must be served behind
the Authelia-protected ingress route so the headers are present; the button
otherwise hits the `401` trust gate.

`frontend2` is still a placeholder shell with no login page, so it carries no
button yet.

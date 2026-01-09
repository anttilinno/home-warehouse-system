# Docspell Integration

Docspell is a document management system for organizing receipts, manuals, warranties, and other documents. HWS integrates with Docspell to link documents to inventory items.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   HWS UI    │────▶│  HWS Backend     │────▶│  Docspell API   │
└─────────────┘     └──────────────────┘     └─────────────────┘
                                                      │
                                              ┌───────┴───────┐
                                              ▼               ▼
                                        ┌──────────┐   ┌──────────┐
                                        │ Restserver│   │   JOEX   │
                                        └──────────┘   └──────────┘
                                              │               │
                                              └───────┬───────┘
                                                      ▼
                                              ┌──────────────┐
                                              │  PostgreSQL  │
                                              └──────────────┘
```

## Starting Docspell

Docspell is included in the project's docker-compose.yml and starts with other services:

```bash
mise run dc-up
```

This starts:
- **docspell-restserver** (port 7880) - REST API and web UI
- **docspell-joex** (port 7878) - Job executor for OCR and processing
- **docspell-postgres** (port 5433) - Dedicated PostgreSQL database

## Initial Setup

### 1. Access Docspell UI

Open http://localhost:7880 in your browser.

### 2. Create a Collective

A collective is Docspell's term for a tenant/organization. Each HWS workspace can connect to a different collective.

1. Click "Sign up" on the login page
2. Create a collective:
   - **Collective Name**: e.g., `home` (this is your organization)
   - **Username**: Your login username
   - **Password**: Your password

### 3. Configure in HWS

In HWS, go to **Workspace Settings → Integrations → Docspell**:

| Field | Value |
|-------|-------|
| Base URL | `http://localhost:7880` |
| Collective Name | `home` (or your collective name) |
| Username | Your Docspell username |
| Password | Your Docspell password |

Click "Test Connection" to verify, then save.

## Features

### Link Documents to Items

1. Upload documents to Docspell (receipts, manuals, warranties)
2. In HWS, open an item and go to "Attachments"
3. Click "Link Docspell Document"
4. Search for the document and link it

### Search Docspell from HWS

Use the search bar in HWS with the `doc:` prefix:

```
doc:warranty drill
```

This searches Docspell's fulltext index and shows matching documents.

### Tag Synchronization

When enabled, HWS labels sync with Docspell tags:
- Creating a label in HWS creates a tag in Docspell
- Applying a label to an item applies the tag to linked documents

Enable in Workspace Settings → Integrations → Docspell → "Sync Tags".

## Environment Variables

Default credentials in docker-compose.yml (change in production):

| Variable | Default | Description |
|----------|---------|-------------|
| Postgres User | `docspell` | Docspell database user |
| Postgres Password | `docspell` | Docspell database password |
| Admin Secret | `admin-secret-change-me` | Admin API access |
| Auth Secret | `b64:EirgOHn...` | JWT signing key |

### Production Configuration

For production, create a `.env` file or override in docker-compose.override.yml:

```yaml
services:
  docspell-restserver:
    environment:
      DOCSPELL_SERVER_ADMIN_ENDPOINT_SECRET: "your-secure-admin-secret"
      DOCSPELL_SERVER_AUTH_SERVER_SECRET: "b64:your-secure-auth-secret"
      DOCSPELL_SERVER_BACKEND_SIGNUP_MODE: "closed"
```

## Ports

| Service | Port | Description |
|---------|------|-------------|
| docspell-restserver | 7880 | Web UI and REST API |
| docspell-joex | 7878 | Job executor |
| docspell-postgres | 5433 | PostgreSQL (mapped to avoid conflict with HWS db) |

## Volumes

| Volume | Purpose |
|--------|---------|
| `docspell_postgres_data` | Docspell database |
| `docspell_data` | Uploaded files and processing data |

## Troubleshooting

### Connection Refused

Ensure Docspell is running:
```bash
docker ps | grep docspell
```

If not running, check logs:
```bash
docker logs warehouse-docspell-restserver
```

### OCR Not Working

JOEX handles OCR processing. Check its status:
```bash
docker logs warehouse-docspell-joex
```

The JOEX container needs to register with the restserver. This may take a minute after startup.

### Reset Docspell Data

To completely reset Docspell:
```bash
docker compose down
docker volume rm home-warehouse-system_docspell_postgres_data
docker volume rm home-warehouse-system_docspell_data
docker compose up -d
```

## API Reference

Docspell API documentation: http://localhost:7880/api/doc

Common endpoints used by HWS:
- `POST /api/v1/sec/auth/login` - Authenticate
- `GET /api/v1/sec/item/search` - Search documents
- `GET /api/v1/sec/item/{id}` - Get document details
- `GET /api/v1/sec/attachment/{id}/preview` - Get document preview

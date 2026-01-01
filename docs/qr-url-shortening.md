# QR Code URL Shortening

This guide explains how to set up short URLs for QR codes in your intranet, enabling quick scanning of container, item, and location labels.

## Overview

HMS uses 8-character short codes for entities:
- **Containers**: `BOX001`, `SHELF-A`
- **Locations**: `GAR-001`, `KITCHEN`
- **Items**: `DRILL01`, `TAPE-3M`

QR codes on printed labels encode short URLs like `http://s.go/BOX001`, which redirect to the full dashboard page.

### Flow

```
Scan QR Code → http://s.go/BOX001 → Backend Lookup → Redirect
                                           ↓
                        https://hms.local/en/dashboard/containers/{uuid}
```

## DNS Setup

Your intranet devices need to resolve `s.go` to your HMS server IP.

### Option 1: Pi-hole / dnsmasq (Recommended)

If you run Pi-hole or dnsmasq on your network:

```bash
# /etc/dnsmasq.d/hms-shorturl.conf
address=/s.go/192.168.1.100
```

Replace `192.168.1.100` with your HMS server IP.

Restart dnsmasq:
```bash
sudo systemctl restart dnsmasq
# or for Pi-hole
pihole restartdns
```

### Option 2: Router DNS

Most home routers support custom DNS entries:

1. Access router admin panel (usually `192.168.1.1`)
2. Find DNS or DHCP settings
3. Add static DNS entry: `s.go` → `192.168.1.100`

### Option 3: Hosts File (Testing/Fallback)

For individual devices or testing:

**Linux/macOS**: `/etc/hosts`
```
192.168.1.100   s.go
```

**Windows**: `C:\Windows\System32\drivers\etc\hosts`
```
192.168.1.100   s.go
```

### Option 4: Active Directory DNS

For Windows domain networks:

1. Open DNS Manager on your domain controller
2. Create a new A record in your zone:
   - Name: `s.go`
   - IP: `192.168.1.100`

## Traefik Configuration

Configure Traefik to route `s.go` requests to the backend redirect endpoint.

### Docker Compose Labels

Add these labels to your backend service in `docker-compose.yml`:

```yaml
services:
  backend:
    # ... existing config ...
    labels:
      # Existing HMS labels
      - "traefik.http.routers.hms-backend.rule=Host(`hms.local`) && PathPrefix(`/api`)"
      - "traefik.http.routers.hms-backend.service=hms-backend"
      - "traefik.http.services.hms-backend.loadbalancer.server.port=8000"

      # Short URL router for s.go
      - "traefik.http.routers.shorturl.rule=Host(`s.go`)"
      - "traefik.http.routers.shorturl.service=hms-backend"
      - "traefik.http.routers.shorturl.priority=100"
```

### Traefik Static Configuration (Alternative)

If you prefer file-based configuration:

```yaml
# traefik/dynamic/shorturl.yml
http:
  routers:
    shorturl:
      rule: "Host(`s.go`)"
      service: hms-backend
      entryPoints:
        - web

  services:
    hms-backend:
      loadBalancer:
        servers:
          - url: "http://backend:8000"
```

### Path Rewriting

The backend expects requests at `/r/{code}`. Configure Traefik to rewrite paths:

```yaml
labels:
  # Rewrite s.go/{code} to /r/{code}
  - "traefik.http.middlewares.shorturl-path.replacepathregex.regex=^/(.+)$$"
  - "traefik.http.middlewares.shorturl-path.replacepathregex.replacement=/r/$$1"
  - "traefik.http.routers.shorturl.middlewares=shorturl-path"
```

## Redirect Logic

The backend needs an endpoint to resolve short codes and redirect to the appropriate page.

### Backend Endpoint

Add a redirect controller to the Litestar backend:

**Endpoint**: `GET /r/{code}`

**Logic**:
1. Query database for short code across all entity tables
2. Determine entity type (container, location, item)
3. Return 302 redirect to dashboard page

**Database Query**:
```sql
SELECT 'container' as type, id FROM warehouse.containers WHERE short_code = $1
UNION ALL
SELECT 'location' as type, id FROM warehouse.locations WHERE short_code = $1
UNION ALL
SELECT 'item' as type, id FROM warehouse.items WHERE short_code = $1
LIMIT 1;
```

**Redirect Mapping**:
| Type | Redirect URL |
|------|-------------|
| container | `/en/dashboard/containers?id={uuid}` |
| location | `/en/dashboard/locations?id={uuid}` |
| item | `/en/dashboard/items/{uuid}` |

**Example Response**:
```http
HTTP/1.1 302 Found
Location: https://hms.local/en/dashboard/containers?id=0192f8a1-...
```

### Implementation Notes

- Return 404 if short code not found
- Consider workspace context for multi-tenant setups
- Cache lookups for frequently scanned codes
- Log scans for analytics (optional)

## QR Code Labels

### URL Format

```
http://s.go/{SHORT_CODE}
```

Examples:
- `http://s.go/BOX001`
- `http://s.go/GAR-A1`
- `http://s.go/DRILL01`

### Label Design Recommendations

```
┌─────────────────────┐
│   ┌───────────┐     │
│   │  QR CODE  │     │
│   │           │     │
│   └───────────┘     │
│                     │
│     BOX-001         │  ← Human-readable code
│   Storage Box A     │  ← Optional description
└─────────────────────┘
```

- Print the short code below the QR for manual entry
- Use high contrast (black on white)
- Minimum QR size: 2cm x 2cm for reliable scanning
- Consider laminated labels for durability

### QR Code Generation

**Python** (for batch generation):
```python
import qrcode

def generate_label_qr(short_code: str) -> bytes:
    url = f"http://s.go/{short_code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    return img
```

**React** (for in-app display):
```tsx
import { QRCodeSVG } from 'qrcode.react';

function ContainerQR({ shortCode }: { shortCode: string }) {
  return (
    <QRCodeSVG
      value={`http://s.go/${shortCode}`}
      size={128}
      level="M"
    />
  );
}
```

## Testing

1. **Verify DNS resolution**:
   ```bash
   ping s.go
   # Should resolve to your HMS server IP
   ```

2. **Test Traefik routing**:
   ```bash
   curl -v http://s.go/TEST001
   # Should return 302 redirect or 404
   ```

3. **Test full flow**:
   - Print a test QR code
   - Scan with phone camera
   - Verify redirect to correct dashboard page

## Troubleshooting

### DNS not resolving
- Check dnsmasq/Pi-hole logs
- Verify device is using correct DNS server
- Try flushing DNS cache: `sudo systemd-resolve --flush-caches`

### Traefik not routing
- Check Traefik dashboard for router status
- Verify labels are applied: `docker inspect backend`
- Check Traefik logs: `docker logs traefik`

### QR code not scanning
- Ensure sufficient lighting
- Check QR code size (minimum 2cm)
- Verify URL is correctly encoded
- Test with different QR scanner apps

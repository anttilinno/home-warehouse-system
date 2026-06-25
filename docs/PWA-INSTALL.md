# Installing the Warehouse PWA on Android

The frontend is a PWA (`vite-plugin-pwa` — manifest + service worker generated
at build). Once installed it runs standalone (no browser chrome), like a native
app, from the Android home screen.

This is a **one-time manual setup per device**. The blocker is TLS trust, not
the app itself.

## Why it needs setup

The homelab serves `warehouse.k3s.lan` over HTTPS with a cert from the
**internal step-ca** (`step-ca-acme` ClusterIssuer, CA = "Homelab CA Root CA").
Chrome refuses to register a service worker on an untrusted cert chain, and no
service worker means no real PWA install (just a dumb bookmark).

A fresh device doesn't have the homelab root CA, so Chrome shows
"your connection is not private". Importing the root CA fixes it — and trusts
**every** `*.k3s.lan` service on that device at once (jellyfin, immich,
grafana, …), not just the warehouse app.

> A publicly-trusted cert (Let's Encrypt / Cloudflare) is **not** needed and
> can't be issued for `.lan` anyway. Use the internal CA.

## One-time setup

### 1. Export the homelab root CA

```bash
kubectl get cm -n step-ca step-certificates-certs \
  -o jsonpath='{.data.root_ca\.crt}' > homelab-ca.crt
```

(configmap `step-certificates-certs`, key `root_ca.crt`). The `.crt` extension
matters — Android keys off it.

### 2. Transfer `homelab-ca.crt` to the phone

Any path works: email, USB, Syncthing, or download it from a LAN box in the
phone browser.

### 3. Install it as a CA certificate

Settings → **Security & privacy** → **More security settings** →
**Encryption & credentials** → **Install a certificate** → **CA certificate**

(exact path varies by vendor — search settings for "CA certificate" if the menu
differs)

- Tap through the **"Install anyway"** warning
- Pick `homelab-ca.crt`
- Confirms "CA installed"

### 4. Point the phone at the homelab DNS

The phone must resolve `warehouse.k3s.lan` → `192.168.10.21` via **Technitium**
(ns `technitium`). Set it as the DNS resolver (DHCP-provided on the LAN, or
manual). Off the LAN / off the homelab DNS, the name won't resolve.

### 5. Install the app

1. Open `https://warehouse.k3s.lan` in Chrome → padlock, no warning
2. ⋮ menu → **Install app** (or **Add to Home screen**)
3. Launches standalone from the home screen

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Connection not private" | CA not installed / wrong file | Re-do step 3 with the `.crt` file |
| Name won't resolve | Phone not using Technitium DNS | Step 4 |
| No "Install app", only "Add shortcut" | Service worker didn't register (cert still untrusted) | Confirm padlock is clean first |
| Router blocks public name → private IP (rebinding) | Only relevant if you ever switch to a `ratakosk.eu` host | Whitelist the domain in the router, or use split-horizon DNS |

## Notes

- Same step applies to any new device (laptop, other phones).
- Desktop Chrome: F12 → Application tab → Manifest / Service Workers to debug.
- See also memory `reference-homelab-ca-trust`.

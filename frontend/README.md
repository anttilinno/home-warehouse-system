# Home Warehouse System - Frontend

A Progressive Web App (PWA) frontend for the Home Warehouse System, built with Next.js 16.

## Features

- **Progressive Web App** - Installable on mobile and desktop, works offline
- **Barcode/QR Scanning** - Scan barcodes and QR codes with device camera
- **Multi-language** - English, Estonian, and Russian
- **Multiple Themes** - Light, Dark, Retro Light, and Retro Dark
- **Offline Support** - Browse cached data and queue changes for sync

## Tech Stack

- Next.js 16 with App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui components
- Serwist (PWA/Service Worker)
- Dexie.js (IndexedDB)
- html5-qrcode (Barcode scanning)

## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev/) - Tool version manager
- [bun](https://bun.sh/) - JavaScript runtime and package manager

### Installation

```bash
# Install dependencies
mise run fe-install
# or
bun install
```

### Development

```bash
# Start development server
mise run fe-dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Build for production
mise run fe-build
# or
bun run build
```

**Note**: The build uses `--webpack` flag due to Serwist/Turbopack incompatibility.

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── sw.ts              # Service worker entry
│   └── [locale]/          # Localized routes
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── pwa/               # PWA install prompt, offline indicator
│   └── scanner/           # Barcode scanner components
├── lib/
│   ├── api.ts             # Backend API client
│   ├── pwa/               # PWA utilities (IndexedDB, sync)
│   └── scanner/           # Scanner hook
├── hooks/                 # React hooks
├── messages/              # i18n translations (en, et, ru)
├── public/
│   ├── manifest.json      # PWA manifest
│   └── icons/             # PWA icons
└── styles/                # Global CSS and themes
```

## Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000  # Backend API URL
```

## PWA Features

### Installation

The app can be installed from:
- Chrome/Edge: Click install icon in address bar
- Safari iOS: Share > Add to Home Screen
- Android: Browser menu > Install app

### Offline Support

- Cached pages work offline
- Data is stored in IndexedDB
- Changes are queued and synced when back online

### Barcode Scanner

Access via the floating scan button (bottom-right) on the dashboard. Supports:
- QR Codes
- EAN-13, EAN-8
- UPC-A, UPC-E
- Code-128, Code-39

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed development documentation.

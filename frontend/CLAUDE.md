# Frontend CLAUDE.md

Frontend-specific guidance for Claude Code when working in the `frontend/` directory.

## Tech Stack

- **Next.js 16** with App Router
- **React 19** with Server Components
- **TypeScript 5**
- **Tailwind CSS 4** with CSS variables for theming
- **shadcn/ui** - Component library (Radix UI primitives)
- **next-intl** - Internationalization (EN, ET, RU)
- **next-themes** - Theme switching (light, dark, retro-light, retro-dark)
- **Lucide React** - Icons (standard themes)
- **Material Symbols** - Icons (retro themes)
- **Recharts** - Charts and analytics
- **Serwist** - PWA service worker (offline support)
- **Dexie.js** - IndexedDB wrapper (offline storage)
- **html5-qrcode** - Barcode/QR code scanning

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Landing page (redirects)
│   ├── [locale]/               # Localized routes
│   │   ├── login/              # Login page
│   │   ├── register/           # Registration page
│   │   └── dashboard/          # Protected dashboard routes
│   │       ├── layout.tsx      # Dashboard layout with sidebar
│   │       ├── page.tsx        # Dashboard home
│   │       ├── inventory/      # Inventory management
│   │       ├── items/          # Item catalog
│   │       ├── locations/      # Storage locations
│   │       ├── containers/     # Storage containers
│   │       ├── loans/          # Loan management
│   │       ├── borrowers/      # Borrower management
│   │       ├── categories/     # Category management
│   │       ├── analytics/      # Reports and charts
│   │       ├── notifications/  # User notifications
│   │       ├── settings/       # App settings
│   │       └── profile/        # User profile
│   └── dashboard/[[...slug]]/  # Catch-all for legacy routes
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── dashboard/              # Dashboard-specific components
│   │   ├── sidebar.tsx         # Navigation sidebar
│   │   └── alert-card.tsx      # Dashboard alerts
│   ├── pwa/                    # PWA components
│   │   ├── install-prompt.tsx  # PWA install banner
│   │   └── offline-indicator.tsx # Offline status indicator
│   ├── scanner/                # Barcode scanner components
│   │   ├── barcode-scanner.tsx # Full-screen scanner modal
│   │   └── scan-button.tsx     # Floating scan button (FAB)
│   ├── icons.tsx               # Theme-aware icon component
│   ├── header.tsx              # Page header
│   └── theme-provider.tsx      # Theme context
├── lib/
│   ├── api.ts                  # API client and endpoints
│   ├── auth.tsx                # Authentication context
│   ├── utils.ts                # Utility functions (cn, etc.)
│   ├── category-utils.ts       # Category tree helpers
│   ├── pwa/                    # PWA utilities
│   │   ├── db.ts               # Dexie IndexedDB schema
│   │   ├── sync.ts             # Background sync logic
│   │   └── offline-queue.ts    # Offline mutation queue
│   └── scanner/                # Scanner utilities
│       └── use-scanner.ts      # html5-qrcode React hook
├── messages/                   # i18n translation files
│   ├── en.json
│   ├── et.json
│   └── ru.json
├── styles/
│   └── globals.css             # Global styles and theme variables
└── config/
    └── site.ts                 # Site configuration
```

## Theming

Four themes available via `next-themes`:
- `light` - Standard light theme
- `dark` - Standard dark theme
- `retro-light` - 8-bit retro light (beige, red accents)
- `retro-dark` - 8-bit retro dark (zinc, red accents)

### Theme Variables

Defined in `styles/globals.css`:
```css
:root {
  --background: ...;
  --foreground: ...;
  --primary: ...;
  --card: ...;
  /* ... */
}

.dark { /* dark overrides */ }
.retro-light { /* retro light theme */ }
.retro-dark { /* retro dark theme */ }
```

### Theme-Aware Icons

Use the `Icon` component from `components/icons.tsx`:
```tsx
import { Icon } from "@/components/icons";

// Automatically uses Lucide for standard themes,
// Material Symbols for retro themes
<Icon name="Home" className="w-4 h-4" />
```

## Internationalization

Three languages: English (en), Estonian (et), Russian (ru)

### Using Translations
```tsx
import { useTranslations } from "next-intl";

function MyComponent() {
  const t = useTranslations("dashboard");
  return <h1>{t("title")}</h1>;
}
```

### Adding Translations
Edit files in `messages/`:
```json
{
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "Welcome back!"
  }
}
```

## API Integration

API client in `lib/api.ts`:
```tsx
import { itemsApi, inventoryApi, loansApi } from "@/lib/api";

// Fetch items
const items = await itemsApi.list();

// Create item
const newItem = await itemsApi.create({ name: "..." });
```

### Authentication
```tsx
import { useAuth } from "@/lib/auth";

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  // ...
}
```

## Component Patterns

### Page Component
```tsx
"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";

export default function ItemsPage() {
  const { isAuthenticated } = useAuth();
  const t = useTranslations("items");

  if (!isAuthenticated) return null;

  return (
    <div>
      <h1>{t("title")}</h1>
      {/* ... */}
    </div>
  );
}
```

### Using shadcn/ui Components
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
```

## Common Commands

```bash
mise run fe-dev         # Start dev server
mise run fe-build       # Production build
mise run fe-install     # Install dependencies
```

Or directly with bun:
```bash
bun dev                 # Start dev server
bun run build           # Production build
bun install             # Install dependencies
```

## Environment Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000  # Backend API URL
```

## Code Style

- **Components**: PascalCase (`MyComponent.tsx`)
- **Utilities**: camelCase (`utils.ts`)
- **CSS**: Tailwind utility classes
- **Imports**: Use `@/` path alias for project imports

## Progressive Web App (PWA)

The frontend is a full Progressive Web App with offline support and installability.

### Service Worker

Configured via Serwist in `next.config.ts`. Service worker source is `app/sw.ts`.

```ts
// next.config.ts uses withSerwist wrapper
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});
```

**Note**: Build requires `--webpack` flag due to Turbopack incompatibility:
```bash
next build --webpack
```

### Caching Strategy

- Static assets (`/_next/static/*`): CacheFirst
- API requests (`/api/*`): NetworkFirst with timeout
- HTML pages: NetworkFirst with offline fallback

### Offline Storage

IndexedDB via Dexie.js (`lib/pwa/db.ts`):
- Cached entities: items, locations, containers, inventory, categories
- Offline mutation queue for syncing changes when back online

### PWA Hooks

```tsx
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

function MyComponent() {
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = useInstallPrompt();
  // ...
}
```

### Barcode Scanner

Full-screen scanner with camera support:
```tsx
import { BarcodeScanner } from "@/components/scanner";

<BarcodeScanner
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onScanSuccess={(result, product) => { /* handle scan */ }}
  lookupBarcode={true}  // Auto-lookup via API
/>
```

Scanner hook for custom implementations:
```tsx
import { useScanner } from "@/lib/scanner";

const { startScanning, stopScanning, toggleCamera } = useScanner({
  onScan: (result) => console.log(result.text),
  onError: (error) => console.error(error),
});
```

Supported formats: QR Code, EAN-13, EAN-8, UPC-A, UPC-E, Code-128, Code-39

### Web App Manifest

Located at `public/manifest.json`. PWA icons in `public/icons/`.

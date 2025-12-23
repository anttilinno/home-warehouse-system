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
│   ├── icons.tsx               # Theme-aware icon component
│   ├── header.tsx              # Page header
│   └── theme-provider.tsx      # Theme context
├── lib/
│   ├── api.ts                  # API client and endpoints
│   ├── auth.tsx                # Authentication context
│   ├── utils.ts                # Utility functions (cn, etc.)
│   └── category-utils.ts       # Category tree helpers
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

# Companion App Implementation Plan

## Overview
Create a React Native/Expo companion app for Android in `/app` directory with barcode/QR scanning, quick inventory management, and offline support.

## Tech Stack
- **Framework**: Expo SDK 54 with Expo Router (file-based routing like Next.js)
- **Language**: TypeScript
- **State**: Zustand + React Query with offline persistence
- **Scanning**: expo-camera

## Progress Tracker
- [x] Phase 1: Project setup and dependencies
- [x] Phase 2: API client and auth context
- [x] Phase 3: Barcode scanner component
- [x] Phase 4: Inventory management screens
- [x] Phase 5: Offline support with sync

## Implementation Complete!
All core features have been implemented. To test the app:
1. Ensure the backend is running
2. Run `npm start` in this directory
3. Use Expo Go on Android or run `npm run android`

## MVP Features
1. **Barcode/QR Scanning** - Scan product EAN/UPC and container QR codes
2. **Quick Inventory Add** - Add scanned products to inventory
3. **Container Lookup** - Scan QR to view container contents
4. **Stock Adjustment** - Quick +/- quantity changes
5. **Offline-First Operation** - Full functionality without network, auto-sync when connected

## Offline-First Architecture

### Core Principle
The app must work fully in the garage with no signal. All data is cached locally, all actions are queued, and sync happens automatically when back on home network.

### Local Data Cache
```
AsyncStorage:
├── cache/items          # All workspace items (for barcode matching)
├── cache/locations      # All locations
├── cache/containers     # All containers with short_codes
├── cache/inventory      # Current inventory state
├── cache/categories     # Categories for item creation
└── cache/last_sync      # Timestamp of last successful sync
```

### Offline Action Queue
```typescript
interface QueuedAction {
  id: string;
  type: 'create_item' | 'create_inventory' | 'adjust_stock' | 'update_inventory';
  payload: any;
  timestamp: number;
  retryCount: number;
}
```

### Sync Strategy
1. **On App Start**: Check network, if online → sync (pull latest data, push queued actions)
2. **Background Listener**: NetInfo detects network change → trigger sync
3. **Manual Sync**: Pull-to-refresh on main screens
4. **Conflict Resolution**: Server wins (latest data), but queued actions apply on top

## Project Structure
```
app/
├── app/                      # Expo Router screens
│   ├── _layout.tsx           # Root layout with providers
│   ├── index.tsx             # Entry redirect
│   ├── (auth)/               # Unauthenticated routes
│   │   ├── login.tsx
│   │   └── server-config.tsx
│   └── (main)/               # Authenticated routes (tabs)
│       ├── scan.tsx          # Main scanner screen
│       ├── inventory/
│       │   ├── add.tsx       # Quick add from scan
│       │   └── adjust.tsx    # Stock adjustment
│       ├── containers/
│       │   └── [id].tsx      # Container contents
│       └── settings.tsx
├── components/
│   ├── ui/                   # Button, Card, Input, etc.
│   └── scanner/              # BarcodeScanner, ScanOverlay
├── lib/
│   ├── api/                  # API client
│   ├── storage/              # SecureStore, AsyncStorage wrappers
│   └── hooks/                # useAuth, useOfflineQueue, etc.
└── contexts/                 # AuthContext, WorkspaceContext
```

## Commands
```bash
# Start development server
npm start

# Run on Android
npm run android
```

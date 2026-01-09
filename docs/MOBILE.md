# Mobile App

Expo React Native companion app for Android with barcode/QR scanning, quick inventory management, and offline support.

## Tech Stack

- **Framework**: Expo SDK 54 with Expo Router
- **Language**: TypeScript
- **State**: Zustand + React Query with offline persistence
- **Scanning**: expo-camera

## Commands

```bash
# Install dependencies
mise run app-install

# Start development server (Expo)
mise run app-dev

# Run on Android emulator/device
mise run app-android

# Run on iOS simulator (macOS only)
mise run app-ios

# Run in web browser
mise run app-web
```

## Running on Phone

1. Install [Expo Go](https://expo.dev/client) on your phone
2. Run `mise run app-dev`
3. Scan the QR code with your phone's camera (iOS) or Expo Go app (Android)

## Running in Web Browser

Web mode requires additional dependencies:

```bash
cd app && npm install react-native-web react-dom
```

Then run `mise run app-web`.

## Features

- **Barcode/QR Scanning** - Scan product EAN/UPC and container QR codes
- **Quick Inventory Add** - Add scanned products to inventory
- **Container Lookup** - Scan QR to view container contents
- **Stock Adjustment** - Quick +/- quantity changes
- **Offline-First** - Full functionality without network, auto-sync when connected

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
│       └── containers/
├── components/               # UI components
├── lib/                      # API client, storage, hooks
└── contexts/                 # Auth, Workspace contexts
```

## Offline Architecture

The app works fully offline. All data is cached locally, actions are queued, and sync happens automatically when back online.

See `app/PLAN.md` for detailed offline architecture documentation.

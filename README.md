# ReadLater for Nextcloud

A fully open-source, privacy-first, self-hosted "Read Later" bookmark manager. Save links from your browser and read them on your phone — all stored in a simple `links.json` on your own Nextcloud or any WebDAV server.

[**Browser Extension**](#browser-extension) · [**Mobile App**](#mobile-app) · [**Shared Core**](#shared-core)

## Architecture

```
readlater-for-nextcloud/
├── apps/
│   ├── extension/          # Browser extension (Chrome + Firefox)
│   │   └── src/
│   │       ├── components/ # 7 focused UI components
│   │       ├── context/    # ReadLaterContext (state + actions)
│   │       └── hooks/      # useTheme (matchMedia listener)
│   │
│   └── mobile/             # React Native / Expo mobile app
│       └── src/
│           ├── components/ # 8 focused UI components
│           ├── context/    # ReadLaterContext (SecureStore-backed)
│           └── hooks/      # useTheme (useColorScheme)
│
└── packages/
    └── core/               # Shared TypeScript library
        └── src/
            ├── index.ts    # ReadLaterClient, Zod schemas
            └── __tests__/  # 31 unit tests
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | Turborepo + pnpm workspaces |
| **Language** | TypeScript 5 (strict mode) |
| **Extension UI** | React 19, Vite 8, Tailwind CSS v4 |
| **Mobile UI** | React Native 0.76, Expo SDK 52 |
| **Icons** | Lucide React (web) / Lucide React Native (mobile) |
| **WebDAV** | webdav v5 (HTTP client) |
| **Validation** | Zod (runtime schema validation) |
| **Testing** | Vitest (31 unit tests) |
| **Linting** | ESLint 9 flat config + typescript-eslint |

## Features

### Both Extension & Mobile
- 100 % open source — no third-party accounts, no tracking
- Data stored as `links.json` in a `/ReadLater` directory on your WebDAV server
- Dark mode with system preference detection
- Filter links by status (unread / read / all)
- Sort by newest, oldest, or alphabetically
- Tags and description display on link cards
- Mark all as read / delete all batch operations
- Offline cache — shows last known data when server is unreachable
- Optimistic concurrency — retries on transient network errors

### Browser Extension (Chrome & Firefox)
- One-click save from any tab (save button in header)
- Badge counter showing unread link count, green when current tab is already saved
- Search bar — filter links by title, URL, or tags
- WebDAV connection test button
- **Draft auto-save** — form inputs persist even when the popup closes (switch windows safely)
- **Reactivation** — saving an already-read link marks it unread and moves it back to the top
- Error boundary with reload fallback

### Mobile App (Expo)
- Manual link entry via bottom-sheet modal (URL + title)
- Pull-to-refresh link list
- Toast-style status banner with auto-dismiss
- Secure credential storage via expo-secure-store
- System dark mode via `useColorScheme`

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [pnpm](https://pnpm.io/installation) v8 or higher

### Install

```bash
git clone https://github.com/YOUR_USER/readlater-for-nextcloud.git
cd readlater-for-nextcloud
pnpm install
```

### Commands

```bash
pnpm dev           # All apps in development mode
pnpm build         # Build core library + extension
pnpm lint          # ESLint across all packages
pnpm test          # Run 31 core unit tests
pnpm format        # Prettier across all TypeScript/CSS files
```

After building, the extension output is in `apps/extension/dist/`. Load it as an **unpacked extension** in Chrome or Firefox.

---

## WebDAV Setup

1. Open the extension popup and enter your **WebDAV URL** (e.g. `https://cloud.example.com/remote.php/dav/files/username/`).
2. Enter your **username** and an **app password** (or use browser session auth by leaving credentials empty).
3. Click **Test Connection** to verify.
4. Click **Save**. The form **auto-saves drafts** — you can safely switch windows to copy credentials from your password manager.

---

## Packaging for Store

### Chrome
```bash
pnpm package:extension
```
Generates `readlater-chrome.zip` and `readlater-firefox.zip` with manifest adjustments per browser.

### Mobile
```bash
cd apps/mobile
npx expo start        # Test via Expo Go
eas build              # Standalone APK/IPA via EAS
```

---

## License

MIT — feel free to fork, modify, and share. ReadLater for Nextcloud does not collect any user data. Communication is exclusively between your device and your WebDAV server.

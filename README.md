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
| **Background (mobile)** | expo-notifications (badge), foreground refresh on app resume |
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
- Bulk save — with 2+ tabs highlighted, the save button shows a count badge and saves them all
- Badge counter showing unread link count, green when current tab is already saved
- Search bar — filter links by title, URL, or tags
- **Selection actions** — check single links or "select all", then open, mark as read, or delete them in bulk
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
- App icon badge with unread count (iOS) + unread counter in the header
- Refreshes on app start and when returning to the foreground

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

## Nextcloud Setup

Both the browser extension and the mobile app connect through the
**Nextcloud Login Flow v2** — no WebDAV URL or app password is entered by hand.

1. Enter your **Nextcloud instance** (e.g. `cloud.example.com`).
2. Enter the **storage folder** where ReadLater keeps its data (e.g. `AppSync`,
   or `/` for the root). The folder must already exist in your Nextcloud files.
3. Start the connection (**Connect to Nextcloud**). A browser opens where you
   sign in — including two-factor authentication — and grant access.
4. Access is granted through a generated **app password**. ReadLater stores only
   the server, login name, app password and user id; the password can be revoked
   any time under *Nextcloud → Settings → Security → App passwords*.

ReadLater writes its data (`links.json` and favicons) to `<folder>/ReadLater/`.

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

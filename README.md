# ReadLater for Nextcloud 🔗 (Open Source)

**ReadLater for Nextcloud** is a **fully open-source**, private, self-hosted "Read Later" solution. It allows you to save bookmarks and articles directly to your own **Nextcloud** or any **WebDAV** server. No third-party accounts, no tracking—just your data on your server.

This project is built as a modern monorepo containing a browser extension, a mobile app, and a shared core logic package.

---

## 🏗 Project Structure

The project uses [Turborepo](https://turbo.build/) and [pnpm](https://pnpm.io/) for workspace management:

- `apps/extension`: Browser extension built with **React**, **Vite**, and **Tailwind CSS v4**. Supports Chromium and Firefox based Browsers.
- `apps/mobile`: Mobile application built with **React Native** and **Expo**.
- `packages/core`: Shared TypeScript library handling all WebDAV synchronization, data validation (Zod), and link management logic.
- `packages/typescript-config`: Shared TS configurations.

---

## ✨ Features

- **100% Open Source:** Transparent, community-driven development.
- **Privacy First:** All data is stored as a simple `links.json` file in a `/ReadLater for Nextcloud` (or custom) directory on your WebDAV server.
- **Cross-Platform:** Save links on your desktop and read them on your mobile device.
- **Smart Detection:** Real-time visual feedback (badge icon) in the browser if a page is already saved.
- **Intelligent Save:** Reactivates "Read" links if you save them again, moving them back to the top.
- **Dark Mode:** Full support for system-wide dark mode or manual preference.
- **Filtering & Sorting:** Manage your list by read/unread status, date, or title.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/installation) (v8 or higher)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd read-l8r

# Install dependencies
pnpm install
```

### Development

Run all apps in development mode:

```bash
pnpm dev
```

### Build

Build the entire project (Core, Extension, and Mobile):

```bash
pnpm build
```

The compiled browser extension will be located in `apps/extension/dist`.

---

## 🛠 WebDAV Setup

1. Open the **ReadLater for Nextcloud** extension settings.
2. Enter your WebDAV URL (e.g., `https://your-cloud.com/remote.php/dav/files/username/`).
3. Ensure you are logged into your Nextcloud instance in the browser, or provide explicit credentials in the settings.
4. Click **Test Connection** to verify.

---

## 📦 Deployment & Stores

### Browser Extension
The extension is Manifest V3 compliant and compatible with:
- **Chrome Web Store**
- **Firefox Add-ons (AMO)**

To package for store upload:
```bash
cd apps/extension/dist && zip -r ../linkkeep-extension.zip .
```

### Mobile App
The mobile app is powered by **Expo**. You can test it via Expo Go or build standalone binaries using Expo Application Services (EAS).

---

## 🤝 Contributing

As an open-source project, contributions are highly welcome! Whether it's a bug report, a feature request, or a pull request, feel free to get involved.

---

## ⚖️ License & Privacy

ReadLater for Nextcloud does not collect any user data. Communication happens directly between your device and your specified WebDAV server.

**License:** MIT — feel free to fork, modify, and share.

import * as SecureStore from "expo-secure-store";
import type { WebDAVConfig } from "@readlater/core";
import {
  buildWebDavUrl,
  normalizeBasePath,
  type NextcloudConfig,
} from "./loginFlow";

// SecureStore-backed persistence for the Nextcloud Login Flow v2 config,
// mirroring the browser extension's nc_* storage keys.

const KEY_SERVER = "nc_server";
const KEY_USERNAME = "nc_username";
const KEY_APP_PASSWORD = "nc_apppw";
const KEY_UID = "nc_uid";
const KEY_BASE_PATH = "nc_basepath";

// Legacy keys from the previous manual WebDAV form.
const LEGACY_URL = "webdav_url";
const LEGACY_USER = "webdav_user";
const LEGACY_PASS = "webdav_pass";

export function toWebDavConfig(config: NextcloudConfig): WebDAVConfig {
  return {
    url: buildWebDavUrl(config.server, config.uid, config.basePath),
    username: config.username,
    password: config.appPassword,
  };
}

export async function writeStoredConfig(config: NextcloudConfig): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_SERVER, config.server),
    SecureStore.setItemAsync(KEY_USERNAME, config.username || ""),
    SecureStore.setItemAsync(KEY_APP_PASSWORD, config.appPassword || ""),
    SecureStore.setItemAsync(KEY_UID, config.uid),
    SecureStore.setItemAsync(KEY_BASE_PATH, config.basePath || "/"),
  ]);
}

export async function writeBasePath(basePath: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_BASE_PATH, basePath);
}

export async function removeStoredConfig(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_SERVER),
    SecureStore.deleteItemAsync(KEY_USERNAME),
    SecureStore.deleteItemAsync(KEY_APP_PASSWORD),
    SecureStore.deleteItemAsync(KEY_UID),
    SecureStore.deleteItemAsync(KEY_BASE_PATH),
    SecureStore.deleteItemAsync(LEGACY_URL),
    SecureStore.deleteItemAsync(LEGACY_USER),
    SecureStore.deleteItemAsync(LEGACY_PASS),
  ]);
}

/**
 * Reads the stored Nextcloud config, migrating legacy webdav_* values on the
 * fly (same logic as the extension). Returns null when nothing is stored.
 */
export async function readStoredConfig(): Promise<NextcloudConfig | null> {
  const [server, username, appPassword, uid, basePath] = await Promise.all([
    SecureStore.getItemAsync(KEY_SERVER),
    SecureStore.getItemAsync(KEY_USERNAME),
    SecureStore.getItemAsync(KEY_APP_PASSWORD),
    SecureStore.getItemAsync(KEY_UID),
    SecureStore.getItemAsync(KEY_BASE_PATH),
  ]);

  if (server && uid) {
    return {
      server,
      username: username || "",
      appPassword: appPassword || "",
      uid,
      basePath: basePath || "/",
    };
  }

  const legacy = await migrateLegacyConfig();
  if (legacy) {
    await writeStoredConfig(legacy);
    await Promise.all([
      SecureStore.deleteItemAsync(LEGACY_URL),
      SecureStore.deleteItemAsync(LEGACY_USER),
      SecureStore.deleteItemAsync(LEGACY_PASS),
    ]);
    return legacy;
  }

  return null;
}

/**
 * Derives the new config from an old WebDAV URL of the shape
 * `<server>/remote.php/dav/files/<uid><basePath>`.
 */
async function migrateLegacyConfig(): Promise<NextcloudConfig | null> {
  const [url, user, pass] = await Promise.all([
    SecureStore.getItemAsync(LEGACY_URL),
    SecureStore.getItemAsync(LEGACY_USER),
    SecureStore.getItemAsync(LEGACY_PASS),
  ]);
  if (!url) return null;

  const match = url.match(
    /^(https?:\/\/[^/]+)\/remote\.php\/dav\/files\/([^/]+)\/?(.*)$/i,
  );
  if (!match) return null;

  const rest = match[3];
  return {
    server: match[1],
    username: user || "",
    appPassword: pass || "",
    uid: decodeURIComponent(match[2]),
    basePath: normalizeBasePath(rest.length > 0 ? `/${rest}` : "/"),
  };
}

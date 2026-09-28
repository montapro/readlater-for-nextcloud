import browser from "webextension-polyfill";
import type { WebDAVConfig } from "@readlater/core";
import {
  buildWebDavUrl,
  normalizeBasePath,
} from "./loginFlow";

export interface StoredNextcloudConfig {
  server: string;
  username: string;
  appPassword: string;
  uid: string;
  basePath: string;
}

export interface NextcloudStorageKeys {
  server: string;
  username: string;
  appPassword: string;
  uid: string;
  basePath: string;
}

export function toWebDavConfig(stored: NextcloudStorageKeys): WebDAVConfig {
  const url = buildWebDavUrl(stored.server, stored.uid, stored.basePath);
  console.log(
    "ReadLater: WebDAV request",
    url,
    "authUser=" + stored.username,
    "pwLength=" + (stored.appPassword || "").length
  );
  return {
    url,
    username: stored.username,
    password: stored.appPassword,
  };
}

export async function readStoredConfig(): Promise<NextcloudStorageKeys | null> {
  const data = await browser.storage.local.get([
    "nc_server",
    "nc_username",
    "nc_apppw",
    "nc_uid",
    "nc_basepath",
    "webdav_url",
    "webdav_user",
    "webdav_pass",
  ]);

  if (data.nc_server && data.nc_uid) {
    return {
      server: data.nc_server as string,
      username: (data.nc_username as string) || "",
      appPassword: (data.nc_apppw as string) || "",
      uid: data.nc_uid as string,
      basePath: (data.nc_basepath as string) || "/",
    };
  }

  const legacy = migrateLegacyConfig(data);
  if (legacy) {
    await browser.storage.local.set({
      nc_server: legacy.server,
      nc_username: legacy.username,
      nc_apppw: legacy.appPassword,
      nc_uid: legacy.uid,
      nc_basepath: legacy.basePath,
    });
    await browser.storage.local.remove([
      "webdav_url",
      "webdav_user",
      "webdav_pass",
    ]);
    return legacy;
  }

  return null;
}

function migrateLegacyConfig(data: Record<string, unknown>): NextcloudStorageKeys | null {
  const url = data.webdav_url as string | undefined;
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const server = parsed.origin;
    const match = parsed.pathname.match(
      /\/remote\.php\/dav\/files\/([^/]+)\/?(.*)$/
    );
    if (!match) return null;

    return {
      server,
      username: (data.webdav_user as string) || "",
      appPassword: (data.webdav_pass as string) || "",
      uid: decodeURIComponent(match[1]),
      basePath: normalizeBasePath(match[2] ? `/${match[2]}` : "/"),
    };
  } catch {
    return null;
  }
}

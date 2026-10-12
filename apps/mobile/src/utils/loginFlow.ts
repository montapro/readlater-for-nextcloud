// Nextcloud Login Flow v2 – ported from the browser extension
// (apps/extension/src/utils/loginFlow.ts) so both clients use the same
// sign-in model: the user only enters the instance + a storage folder, and a
// browser handles authentication (including 2FA). The returned credentials are
// an app password that `@readlater/core` uses for Basic Auth over WebDAV.

export interface NextcloudLoginFlowStart {
  loginUrl: string;
  pollToken: string;
  pollEndpoint: string;
}

export interface NextcloudCredentials {
  server: string;
  loginName: string;
  appPassword: string;
}

export interface NextcloudLoginFlowResult extends NextcloudCredentials {
  uid: string;
}

export interface NextcloudConfig {
  server: string;
  username: string;
  appPassword: string;
  uid: string;
  basePath: string;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 20 * 60 * 1000;

/**
 * Reduces arbitrary user input (with or without scheme, with a path) to the
 * bare instance origin, e.g. "cloud.example.com/foo" -> "https://cloud.example.com".
 * Implemented without `URL` because React Native's URL polyfill is incomplete.
 */
export function normalizeInstance(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  const match = withProtocol.match(/^(https?:\/\/[^/]+)/i);
  return match ? match[1] : withProtocol;
}

/**
 * Normalizes a folder path to a single leading and trailing slash, dropping
 * empty segments. "/" stays "/"; "AppSync/Notes" -> "/AppSync/Notes/".
 */
export function normalizeBasePath(input: string): string {
  const segments = input
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  return segments.length === 0 ? "/" : `/${segments.join("/")}/`;
}

/**
 * Builds the WebDAV root URL for a Nextcloud account. `@readlater/core`
 * appends its own `/ReadLater` + `/icons` folders to this root.
 */
export function buildWebDavUrl(
  server: string,
  uid: string,
  basePath: string,
): string {
  const origin = normalizeInstance(server);
  const path = normalizeBasePath(basePath);
  return `${origin}/remote.php/dav/files/${encodeURIComponent(uid)}${path}`;
}

export async function startLoginFlow(
  instance: string,
): Promise<NextcloudLoginFlowStart> {
  const server = normalizeInstance(instance);
  if (!server) {
    throw new Error("Enter your Nextcloud instance first.");
  }

  const url = `${server}/index.php/login/v2`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "OCS-APIRequest": "true" },
    redirect: "follow",
  });

  const body = await response.text();
  const data = parseJsonResponse(response, body, url) as {
    poll?: { token?: string; endpoint?: string };
    login?: string;
  };

  if (!data.poll?.token || !data.poll.endpoint || !data.login) {
    throw new Error(`Unexpected response from ${url}: ${body.slice(0, 300)}`);
  }

  return {
    loginUrl: data.login,
    pollToken: data.poll.token,
    pollEndpoint: data.poll.endpoint,
  };
}

export async function pollLoginFlow(
  pollEndpoint: string,
  pollToken: string,
  shouldAbort?: () => boolean,
): Promise<NextcloudCredentials> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(pollEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `token=${encodeURIComponent(pollToken)}`,
    });

    const body = await response.text();

    if (response.ok) {
      const data = parseJsonResponse(response, body, pollEndpoint) as {
        server?: string;
        loginName?: string;
        appPassword?: string;
      };
      if (!data.server || !data.loginName || !data.appPassword) {
        throw new Error(
          `Login flow finished but returned incomplete data: ${body.slice(0, 300)}`,
        );
      }
      return {
        server: normalizeInstance(data.server),
        loginName: data.loginName,
        appPassword: data.appPassword,
      };
    }

    if (response.status !== 404) {
      throw new Error(
        `Login flow polling failed (HTTP ${response.status}): ${body.slice(0, 300)}`,
      );
    }

    if (shouldAbort?.()) {
      throw new Error("Login cancelled.");
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error("Login flow timed out. Please try again.");
}

/**
 * Resolves the Nextcloud user id (UID) used in the WebDAV path. `loginName`
 * can differ from the UID (e.g. an email address), so we ask OCS; if that
 * fails we fall back to the login name.
 */
export async function fetchUid(
  server: string,
  loginName: string,
  appPassword: string,
): Promise<string> {
  const origin = normalizeInstance(server);
  try {
    const response = await fetch(`${origin}/ocs/v1.php/cloud/user?format=json`, {
      headers: {
        Authorization: `Basic ${toBase64(`${loginName}:${appPassword}`)}`,
        "OCS-APIRequest": "true",
      },
    });
    if (!response.ok) return loginName;
    const data = (await response.json()) as {
      ocs?: { data?: { id?: string } };
    };
    return data.ocs?.data?.id || loginName;
  } catch {
    return loginName;
  }
}

function parseJsonResponse(
  response: Response,
  body: string,
  url: string,
): unknown {
  try {
    return JSON.parse(body);
  } catch {
    const isHtml = /^\s*<(!DOCTYPE|html)/i.test(body);
    throw new Error(
      `Expected JSON from ${url} (HTTP ${response.status}) but got ` +
        `${isHtml ? "an HTML page" : "invalid data"}: ${body.slice(0, 300)}`,
    );
  }
}

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

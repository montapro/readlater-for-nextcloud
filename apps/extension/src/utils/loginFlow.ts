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

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 20 * 60 * 1000;

export function normalizeInstance(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return withProtocol;
  }
}

export function normalizeBasePath(input: string): string {
  const segments = input
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  return segments.length === 0 ? "/" : `/${segments.join("/")}/`;
}

export function buildWebDavUrl(
  server: string,
  uid: string,
  basePath: string
): string {
  const origin = normalizeInstance(server);
  const path = normalizeBasePath(basePath);
  return `${origin}/remote.php/dav/files/${encodeURIComponent(uid)}${path}`;
}

export function buildStorageUrl(
  server: string,
  uid: string,
  basePath: string
): string {
  return buildWebDavUrl(server, uid, basePath) + "ReadLater/";
}

export async function startLoginFlow(
  instance: string
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
    credentials: "omit",
  });

  const body = await response.text();
  console.log(
    `ReadLater: login flow response: type=${response.type} redirected=${response.redirected} url=${response.url} status=${response.status} ct=${response.headers.get("content-type")} bodylen=${body.length}`
  );
  if (response.redirected) {
    console.log("ReadLater: REDIRECTED from", url, "→ following", response.url);
  }

  const data = parseJsonResponse(response, body, url) as {
    poll?: { token?: string; endpoint?: string };
    login?: string;
  };

  if (!data.poll?.token || !data.poll.endpoint || !data.login) {
    throw new Error(
      `Unexpected response from ${url}: ${body.slice(0, 300)}`
    );
  }

  return {
    loginUrl: data.login,
    pollToken: data.poll.token,
    pollEndpoint: data.poll.endpoint,
  };
}

export async function pollLoginFlow(
  pollEndpoint: string,
  pollToken: string
): Promise<NextcloudCredentials> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(pollEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `token=${encodeURIComponent(pollToken)}`,
      credentials: "omit",
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
          `Login flow finished but returned incomplete data: ${body.slice(0, 300)}`
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
        `Login flow polling failed (HTTP ${response.status}) on ${pollEndpoint}: ${body.slice(0, 300)}`
      );
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error("Login flow timed out. Please try again.");
}

export async function fetchUid(
  server: string,
  loginName: string,
  appPassword: string
): Promise<string> {
  const origin = normalizeInstance(server);
  try {
    const response = await fetch(`${origin}/ocs/v1.php/cloud/user?format=json`, {
      headers: {
        Authorization: `Basic ${toBase64(`${loginName}:${appPassword}`)}`,
        "OCS-APIRequest": "true",
      },
      credentials: "omit",
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
  url: string
): unknown {
  try {
    return JSON.parse(body);
  } catch {
    const isHtml = /^\s*<(!DOCTYPE|html)/i.test(body);
    throw new Error(
      `Expected JSON from ${url} (HTTP ${response.status}, ` +
        `${response.headers.get("content-type") || "no content-type"}) ` +
        `but got ${isHtml ? "an HTML page" : "invalid data"}: ` +
        `${body.slice(0, 300)}`
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

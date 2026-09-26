import { fetchPageMetadata } from "../../apps/mobile/src/utils/metadata";

const MAX_URL_LENGTH = 2000;

export default async (request: Request): Promise<Response> => {
  const target = new URL(request.url).searchParams.get("url") ?? "";
  if (!isAllowedTarget(target)) {
    return jsonResponse({ error: "invalid url" }, 400);
  }
  const meta = await fetchPageMetadata(target);
  return jsonResponse(meta);
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAllowedTarget(raw: string): boolean {
  if (!raw || raw.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname || url.username || url.password) return false;
    return !isBlockedHostname(url.hostname);
  } catch {
    return false;
  }
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host.includes(":")) return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [, a, b] = ipv4.map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

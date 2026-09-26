const FETCH_TIMEOUT_MS = 5000;
const MAX_FAVICON_SIZE = 200_000;
const MAX_HTML_SIZE = 500_000;
const HTML_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
};

export interface PageMetadata {
  title?: string;
  faviconUrl?: string;
  faviconData?: string;
}

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const { response, finalUrl } = await fetchFollowingRedirects(
        url,
        controller.signal,
        HTML_HEADERS
      );
      if (!response.ok) return {};
      const html = (await response.text()).slice(0, MAX_HTML_SIZE);
      const { title, faviconUrl } = parseMetadata(html, finalUrl);
      const faviconData = faviconUrl
        ? await fetchFaviconData(faviconUrl)
        : undefined;
      return { title, faviconUrl, faviconData };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return {};
  }
}

/**
 * Fetches a URL, explicitly following redirects (some React Native fetch
 * implementations return the 3xx response instead of following it).
 */
async function fetchFollowingRedirects(
  url: string,
  signal: AbortSignal,
  headers?: Record<string, string>,
  maxRedirects = 5
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = url;
  for (let i = 0; i < maxRedirects; i++) {
    const response = await fetch(currentUrl, {
      signal,
      headers,
      redirect: "follow",
    });
    if (response.url) currentUrl = response.url;

    if (response.ok) return { response, finalUrl: currentUrl };

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: currentUrl };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return { response, finalUrl: currentUrl };
  }
  const response = await fetch(currentUrl, { signal, headers });
  return { response, finalUrl: currentUrl };
}

async function fetchFaviconData(url: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const { response } = await fetchFollowingRedirects(
        url,
        controller.signal
      );
      if (!response.ok) return undefined;
      const blob = await response.blob();
      if (blob.size > MAX_FAVICON_SIZE) return undefined;
      return await blobToDataUrl(blob);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return undefined;
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
}

function parseMetadata(html: string, baseUrl: string): PageMetadata {
  const ogTitle = matchMeta(html, "og:title");
  const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  const rawTitle = ogTitle || htmlTitle;

  return {
    title: rawTitle ? decodeHtmlEntities(rawTitle).trim() : undefined,
    faviconUrl: extractFaviconUrl(html, baseUrl),
  };
}

/**
 * Decodes HTML entities (`&uuml;` → `ü`, `&#39;` → `'`) so titles from
 * page metadata show correctly. Handles numeric and common named entities.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, (entity) => {
      const mapped = HTML_ENTITIES[entity.toLowerCase()];
      if (mapped === undefined) return entity;
      // Preserve case: &Auml; (Ä) vs &auml; (ä)
      const inner = entity.slice(1, -1);
      if (
        inner.charAt(0) === inner.charAt(0).toUpperCase() &&
        inner.charAt(0) !== inner.charAt(0).toLowerCase()
      ) {
        return mapped.charAt(0).toUpperCase() + mapped.slice(1);
      }
      return mapped;
    });
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": "\u00a0",
  "&middot;": "\u00b7",
  "&mdash;": "\u2014",
  "&ndash;": "\u2013",
  "&hellip;": "\u2026",
  "&lsquo;": "\u2018",
  "&rsquo;": "\u2019",
  "&ldquo;": "\u201c",
  "&rdquo;": "\u201d",
  "&laquo;": "\u00ab",
  "&raquo;": "\u00bb",
  "&copy;": "\u00a9",
  "&reg;": "\u00ae",
  "&trade;": "\u2122",
  "&deg;": "\u00b0",
  "&euro;": "\u20ac",
  // Latin-1 Supplement — covers German, French, Spanish, etc.
  "&iexcl;": "\u00a1",
  "&cent;": "\u00a2",
  "&pound;": "\u00a3",
  "&curren;": "\u00a4",
  "&yen;": "\u00a5",
  "&brvbar;": "\u00a6",
  "&sect;": "\u00a7",
  "&uml;": "\u00a8",
  "&ordf;": "\u00aa",
  "&not;": "\u00ac",
  "&shy;": "\u00ad",
  "&macr;": "\u00af",
  "&plusmn;": "\u00b1",
  "&sup2;": "\u00b2",
  "&sup3;": "\u00b3",
  "&acute;": "\u00b4",
  "&micro;": "\u00b5",
  "&para;": "\u00b6",
  "&cedil;": "\u00b8",
  "&sup1;": "\u00b9",
  "&ordm;": "\u00ba",
  "&frac14;": "\u00bc",
  "&frac12;": "\u00bd",
  "&frac34;": "\u00be",
  "&iquest;": "\u00bf",
  "&agrave;": "\u00c0",
  "&aacute;": "\u00c1",
  "&acirc;": "\u00c2",
  "&atilde;": "\u00c3",
  "&auml;": "\u00c4",
  "&aring;": "\u00c5",
  "&aelig;": "\u00c6",
  "&ccedil;": "\u00c7",
  "&egrave;": "\u00c8",
  "&eacute;": "\u00c9",
  "&ecirc;": "\u00ca",
  "&euml;": "\u00cb",
  "&igrave;": "\u00cc",
  "&iacute;": "\u00cd",
  "&icirc;": "\u00ce",
  "&iuml;": "\u00cf",
  "&eth;": "\u00f0",
  "&ntilde;": "\u00f1",
  "&ograve;": "\u00f2",
  "&oacute;": "\u00f3",
  "&ocirc;": "\u00f4",
  "&ouml;": "\u00f6",
  "&otilde;": "\u00f5",
  "&divide;": "\u00f7",
  "&oslash;": "\u00f8",
  "&ugrave;": "\u00f9",
  "&uacute;": "\u00fa",
  "&ucirc;": "\u00fb",
  "&uuml;": "\u00fc",
  "&yacute;": "\u00fd",
  "&thorn;": "\u00fe",
  "&yuml;": "\u00ff",
};

function matchMeta(html: string, key: string): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const attrFirst = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
    "i"
  );
  return html.match(attrFirst)?.[1] || html.match(contentFirst)?.[1];
}

function extractFaviconUrl(html: string, baseUrl: string): string | undefined {
  // Prefer apple-touch-icon (always PNG — works with RN Image over ICO/SVG)
  const appleTouch = findHref(html, "apple-touch-icon");
  if (appleTouch) return resolveUrl(appleTouch, baseUrl);

  const icon = findHref(html, "icon");
  if (icon) return resolveUrl(icon, baseUrl);

  return resolveUrl("/favicon.ico", baseUrl);
}

function findHref(html: string, rel: string): string | undefined {
  const relFirst = new RegExp(
    `<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]+href=["']([^"']+)["']`,
    "i"
  );
  const hrefFirst = new RegExp(
    `<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${rel}[^"']*["']`,
    "i"
  );
  return html.match(relFirst)?.[1] || html.match(hrefFirst)?.[1];
}

function resolveUrl(href: string, baseUrl: string): string | undefined {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return undefined;
  }
}

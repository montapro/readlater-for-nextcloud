const FETCH_TIMEOUT_MS = 5000;

export interface PageMetadata {
  title?: string;
  faviconUrl?: string;
}

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      });
      if (!response.ok) return {};
      const html = await response.text();
      return parseMetadata(html, url);
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return {};
  }
}

function parseMetadata(html: string, baseUrl: string): PageMetadata {
  const ogTitle = matchMeta(html, "og:title");
  const htmlTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

  return {
    title: (ogTitle || htmlTitle)?.trim() || undefined,
    faviconUrl: extractFaviconUrl(html, baseUrl),
  };
}

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

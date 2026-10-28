import { createClient, WebDAVClient, AuthType, FileStat, ResponseDataDetailed } from "webdav";
import { z, ZodError } from "zod";

// --- Schema Definitions ---

export const LinkSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  addedAt: z.string().datetime(),
  tags: z.array(z.string()).default([]),
  isRead: z.boolean().default(false),
  faviconUrl: z.string().optional(),
  faviconData: z.string().optional(),
  faviconPath: z.string().optional(),
});

export type Link = z.infer<typeof LinkSchema>;

export interface AddLinksResult {
  added: Link[];
  reactivated: Link[];
  skipped: Link[];
}

export const LinkStoreSchema = z.object({
  version: z.string(),
  links: z.array(LinkSchema),
});

export type LinkStore = z.infer<typeof LinkStoreSchema>;

export interface WebDAVConfig {
  url: string;
  username?: string;
  password?: string;
  token?: string;
}

interface FetchResult {
  store: LinkStore;
  etag: string | null;
}

// --- Client Implementation ---

export const FOLDER_MISSING_MESSAGE =
  "The folder you set must already exist on your Nextcloud filesystem.";

export class ReadLaterClient {
  private client: WebDAVClient;
  private readonly config: WebDAVConfig;
  private readonly storagePath = "/ReadLater";
  private readonly iconsPath = "/ReadLater/icons";
  private readonly fileName = "links.json";

  constructor(config: WebDAVConfig) {
    this.config = config;
    const options: {
      headers: Record<string, string>;
      authType?: AuthType;
      username?: string;
      password?: string;
    } = {
      headers: {
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    };

    if (config.username && config.password) {
      options.authType = AuthType.Password;
      options.username = config.username;
      options.password = config.password;
    }

    this.client = createClient(config.url, options);
  }

  /**
   * Tests WebDAV connectivity.
   * Returns detailed result with error message on failure.
   */
  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.client.getDirectoryContents("/", { details: false });
      return { ok: true };
    } catch (error: unknown) {
      const err = error as { status?: number; response?: { status?: number }; message?: string; statusText?: string };
      if (err?.status === 412 || err?.response?.status === 412) {
        return { ok: false, error: "Conflict: the file was modified by another client" };
      }
      if (
        err?.status === 404 ||
        err?.response?.status === 404 ||
        err?.status === 409 ||
        err?.response?.status === 409
      ) {
        return { ok: false, error: FOLDER_MISSING_MESSAGE };
      }
      const message = err?.message || err?.statusText || "Unknown error";
      console.error("ReadLater: Connection check failed", err);
      return { ok: false, error: message };
    }
  }

  async ensureStorageExists(): Promise<void> {
    try {
      if (!(await this.client.exists(this.storagePath))) {
        await this.client.createDirectory(this.storagePath);
      }
    } catch (_error) {
      throw new Error(FOLDER_MISSING_MESSAGE);
    }
  }

  /**
   * Fetches the link store from WebDAV.
   * Differentiates between network errors, corrupted data, and schema mismatches.
   */
  async fetchLinks(): Promise<LinkStore> {
    const fullPath = `${this.storagePath}/${this.fileName}`;
    try {
      if (!(await this.client.exists(fullPath))) {
        return { version: "1.0", links: [] };
      }

      const content = (await this.client.getFileContents(fullPath, {
        format: "text",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      })) as string;

      const data = JSON.parse(content);
      return LinkStoreSchema.parse(data);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          "Links data is corrupted (invalid JSON). Check your links.json file on the server."
        );
      }
      if (error instanceof ZodError) {
        throw new Error(
          "Links data has an invalid format. The file may have been edited manually or is from a newer version."
        );
      }
      throw error;
    }
  }

  /**
   * Internal: fetches links with the ETag for optimistic concurrency.
   */
  private async fetchLinksWithETag(): Promise<FetchResult> {
    const fullPath = `${this.storagePath}/${this.fileName}`;
    if (!(await this.client.exists(fullPath))) {
      return { store: { version: "1.0", links: [] }, etag: null };
    }

    // stat returns the ETag directly in FileStat.etag
    const stat = await this.client.stat(fullPath, { details: true }) as ResponseDataDetailed<FileStat>;
    const etag = stat.data.etag;

    const content = (await this.client.getFileContents(fullPath, {
      format: "text",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    })) as string;

    const data = JSON.parse(content);
    const store = LinkStoreSchema.parse(data);
    return { store, etag };
  }

  /**
   * Internal: saves the link store to WebDAV.
   */
  private async saveLinksInternal(store: LinkStore, _etag?: string | null): Promise<void> {
    LinkStoreSchema.parse(store);
    await this.ensureStorageExists();

    const fullPath = `${this.storagePath}/${this.fileName}`;
    await this.client.putFileContents(fullPath, JSON.stringify(store, null, 2));
  }

  /**
   * Wraps a read-modify-write operation with retry on transient errors.
   */
  private async withRetry<T>(
    operation: (store: LinkStore) => T
  ): Promise<T> {
    let lastError: unknown = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { store } = await this.fetchLinksWithETag();
        const result = await operation(store);
        await this.saveLinksInternal(store);
        return result;
      } catch (error: unknown) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 200 * Math.pow(2, attempt))
          );
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error("Operation failed after multiple attempts.");
  }

  /**
   * Saves the entire link store to WebDAV.
   * Validates the store structure before writing to prevent data corruption.
   */
  async saveLinks(store: LinkStore): Promise<void> {
    try {
      LinkStoreSchema.parse(store);
      await this.ensureStorageExists();

      const fullPath = `${this.storagePath}/${this.fileName}`;
      const content = JSON.stringify(store, null, 2);
      await this.client.putFileContents(fullPath, content);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new Error("Cannot save: link data is invalid.");
      }
      throw new Error(
        "Could not save to WebDAV. Check permissions or login status."
      );
    }
  }

  /**
   * Adds a new link or reactivates an existing one that was marked as read.
   * Uses optimistic concurrency to prevent data loss from parallel writes.
   */
  async addLink(
    linkData: Omit<Link, "id" | "addedAt" | "isRead">
  ): Promise<Link> {
    const { added, reactivated, skipped } = await this.addLinks([linkData]);
    return added[0] ?? reactivated[0] ?? skipped[0];
  }

  /**
   * Adds many links in a single read-modify-write cycle.
   *
   * Per URL: already saved and unread → skipped, saved but read → reactivated
   * (unread again, fresh timestamp), otherwise a new link is created.
   * Duplicate URLs inside the batch are collapsed to their first occurrence.
   */
  async addLinks(
    linksData: Array<Omit<Link, "id" | "addedAt" | "isRead">>
  ): Promise<AddLinksResult> {
    const unique: Array<Omit<Link, "id" | "addedAt" | "isRead">> = [];
    const seen = new Set<string>();
    for (const data of linksData) {
      if (seen.has(data.url)) continue;
      seen.add(data.url);
      unique.push(data);
    }

    if (unique.length === 0) {
      return { added: [], reactivated: [], skipped: [] };
    }

    return this.withRetry((store) => {
      const added: Link[] = [];
      const reactivated: Link[] = [];
      const skipped: Link[] = [];
      const front: Link[] = [];
      const now = new Date().toISOString();

      for (const data of unique) {
        const existingIndex = store.links.findIndex(
          (l) => l.url === data.url
        );

        if (existingIndex !== -1) {
          const existing = store.links[existingIndex];
          // Already saved and unread – nothing to do
          if (!existing.isRead) {
            skipped.push(existing);
            continue;
          }

          // Reactivate: mark unread, update timestamp and title
          existing.isRead = false;
          existing.addedAt = now;
          if (data.title) existing.title = data.title;
          if (data.faviconUrl) existing.faviconUrl = data.faviconUrl;
          if (data.faviconData) existing.faviconData = data.faviconData;
          store.links.splice(existingIndex, 1);
          front.push(existing);
          reactivated.push(existing);
          continue;
        }

        const newLink: Link = {
          ...data,
          id: crypto.randomUUID(),
          addedAt: now,
          isRead: false,
          tags: data.tags || [],
        };
        front.push(newLink);
        added.push(newLink);
      }

      if (front.length > 0) store.links.unshift(...front);
      return { added, reactivated, skipped };
    });
  }

  /**
   * Updates specific fields of an existing link.
   * Uses optimistic concurrency to prevent data loss from parallel writes.
   */
  async updateLink(
    id: string,
    updates: Partial<Omit<Link, "id" | "addedAt">>
  ): Promise<void> {
    await this.withRetry((store) => {
      const index = store.links.findIndex((l) => l.id === id);
      if (index === -1) throw new Error("Link not found.");
      store.links[index] = { ...store.links[index], ...updates };
    });
  }

  /**
   * Removes a single link by ID and its stored favicon file(s).
   * Uses optimistic concurrency to prevent data loss from parallel writes.
   */
  async deleteLink(id: string): Promise<void> {
    await this.deleteLinksMatching((link) => link.id === id);
  }

  /**
   * Removes several links in one read-modify-write cycle, together with
   * their stored favicon files.
   */
  async deleteLinks(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    await this.deleteLinksMatching((link) => idSet.has(link.id));
  }

  /**
   * Marks all links as read with optimistic concurrency.
   */
  async markAllAsRead(): Promise<void> {
    await this.withRetry((store) => {
      store.links = store.links.map((l) => ({ ...l, isRead: true }));
    });
  }

  /**
   * Marks the given links as read in one read-modify-write cycle.
   */
  async markAsRead(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    await this.withRetry((store) => {
      store.links = store.links.map((l) =>
        idSet.has(l.id) ? { ...l, isRead: true } : l
      );
    });
  }

  /**
   * Deletes all links (resets to empty store) with optimistic concurrency.
   * Also removes every stored favicon file.
   */
  async deleteAllLinks(): Promise<void> {
    await this.deleteLinksMatching(() => true);
  }

  /**
   * Internal: removes every link matching the predicate in one write and
   * cleans up the corresponding icon files afterwards.
   */
  private async deleteLinksMatching(
    match: (link: Link) => boolean
  ): Promise<void> {
    const targets = await this.withRetry((store) => {
      const list = store.links
        .filter(match)
        .map((l) => ({ id: l.id, faviconPath: l.faviconPath }));
      store.links = store.links.filter((l) => !match(l));
      return list;
    });
    await Promise.all(
      targets.map((t) => this.deleteIconsForLink(t.id, t.faviconPath))
    );
  }

  /**
   * Uploads a favicon image (as a base64 data URI) to /ReadLater/icons/[id]
   * and returns the WebDAV-relative path (e.g. "ReadLater/icons/<id>.png").
   */
  async saveIcon(id: string, dataUri: string): Promise<string | undefined> {
    try {
      const comma = dataUri.indexOf(",");
      if (comma === -1) return undefined;
      const mime = dataUri.match(/^data:([^;,]+)/)?.[1] || "image/png";
      const base64 = dataUri.slice(comma + 1);
      const ext = mimeToExtension(mime);
      const bytes = base64ToBytes(base64);

      if (!(await this.client.exists(this.iconsPath))) {
        await this.client.createDirectory(this.iconsPath, { recursive: true });
      }

      const davPath = `${this.iconsPath}/${id}.${ext}`;
      await this.client.putFileContents(davPath, bytes.buffer as ArrayBuffer);
      return davPath.replace(/^\//, "");
    } catch {
      return undefined;
    }
  }

  /**
   * Deletes a previously stored favicon file.
   * @param faviconPath WebDAV-relative path returned by saveIcon.
   */
  async deleteIcon(faviconPath: string): Promise<void> {
    const path = faviconPath.startsWith("/") ? faviconPath : `/${faviconPath}`;
    try {
      await this.client.deleteFile(path);
    } catch (error) {
      if (!isNotFound(error)) {
        console.error("ReadLater: Failed to delete icon", path, error);
      }
    }
  }

  /**
   * Deletes every icon file that may belong to a link: the recorded
   * faviconPath plus id-based candidates in /ReadLater/icons (orphan safety).
   */
  private async deleteIconsForLink(
    id: string,
    faviconPath?: string
  ): Promise<void> {
    const paths = new Set<string>();
    if (faviconPath) {
      paths.add(faviconPath.replace(/^\//, ""));
    }
    const iconsRel = this.iconsPath.replace(/^\//, "");
    for (const ext of ICON_EXTENSIONS) {
      paths.add(`${iconsRel}/${id}.${ext}`);
    }
    await Promise.all([...paths].map((p) => this.deleteIcon(p)));
  }
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const ICON_EXTENSIONS = ["png", "ico", "svg"] as const;

function isNotFound(error: unknown): boolean {
  const e = error as { status?: number; response?: { status?: number } };
  return e?.status === 404 || e?.response?.status === 404;
}

function mimeToExtension(mime: string): string {
  if (mime.includes("svg")) return "svg";
  if (mime.includes("icon")) return "ico";
  return "png";
}

function base64ToBytes(base64: string): Uint8Array {
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of base64) {
    if (ch === "=") break;
    const value = BASE64_CHARS.indexOf(ch);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

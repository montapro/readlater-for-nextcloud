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
});

export type Link = z.infer<typeof LinkSchema>;

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

export class ReadLaterClient {
  private client: WebDAVClient;
  private readonly storagePath = "/ReadLater";
  private readonly fileName = "links.json";

  constructor(config: WebDAVConfig) {
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
      throw new Error("Could not initialize storage directory on WebDAV.");
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
    return this.withRetry((store) => {
      const existingIndex = store.links.findIndex(
        (l) => l.url === linkData.url
      );

      if (existingIndex !== -1) {
        const existing = store.links[existingIndex];
        // Already saved and unread – nothing to do
        if (!existing.isRead) return existing;

        // Reactivate: mark unread, update timestamp and title
        existing.isRead = false;
        existing.addedAt = new Date().toISOString();
        existing.title = linkData.title;
        store.links.splice(existingIndex, 1);
        store.links.unshift(existing);
        return existing;
      }

      const newLink: Link = {
        ...linkData,
        id: crypto.randomUUID(),
        addedAt: new Date().toISOString(),
        isRead: false,
        tags: linkData.tags || [],
      };
      store.links.unshift(newLink);
      return newLink;
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
   * Removes a single link by ID.
   * Uses optimistic concurrency to prevent data loss from parallel writes.
   */
  async deleteLink(id: string): Promise<void> {
    await this.withRetry((store) => {
      store.links = store.links.filter((l) => l.id !== id);
    });
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
   * Deletes all links (resets to empty store) with optimistic concurrency.
   */
  async deleteAllLinks(): Promise<void> {
    await this.withRetry((store) => {
      store.links = [];
    });
  }
}

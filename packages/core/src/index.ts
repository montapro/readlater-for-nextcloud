import { createClient, WebDAVClient } from "webdav";
import { z } from "zod";

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
  username: string;
  password?: string;
  token?: string; // For Bearer token auth if needed
}

// --- Client Implementation ---

export class LinkKeepClient {
  private client: WebDAVClient;
  private readonly storagePath = "/LinkKeep";
  private readonly fileName = "links.json";

  constructor(config: WebDAVConfig) {
    this.client = createClient(config.url, {
      username: config.username,
      password: config.password,
    });
  }

  /**
   * Verifies the connection to the WebDAV server.
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.client.getDirectoryContents("/");
      return true;
    } catch (error) {
      console.error("LinkKeep: Connection verification failed", error);
      return false;
    }
  }

  /**
   * Ensures that the /LinkKeep directory exists on the server.
   */
  async ensureStorageExists(): Promise<void> {
    try {
      if (!(await this.client.exists(this.storagePath))) {
        await this.client.createDirectory(this.storagePath);
      }
    } catch (error) {
      console.error("LinkKeep: Failed to create storage directory", error);
      throw new Error("Could not initialize storage directory on WebDAV.");
    }
  }

  /**
   * Fetches the current link store from WebDAV.
   * If the file doesn't exist, returns an empty store.
   */
  async fetchLinks(): Promise<LinkStore> {
    const fullPath = `${this.storagePath}/${this.fileName}`;
    try {
      if (!(await this.client.exists(fullPath))) {
        return { version: "1.0", links: [] };
      }

      const content = (await this.client.getFileContents(fullPath, {
        format: "text",
      })) as string;
      const data = JSON.parse(content);
      return LinkStoreSchema.parse(data);
    } catch (error) {
      console.error("LinkKeep: Failed to fetch links", error);
      throw new Error("Could not fetch links from WebDAV.");
    }
  }

  /**
   * Saves the link store to WebDAV.
   */
  async saveLinks(store: LinkStore): Promise<void> {
    const fullPath = `${this.storagePath}/${this.fileName}`;
    try {
      await this.ensureStorageExists();
      const content = JSON.stringify(store, null, 2);
      await this.client.putFileContents(fullPath, content);
    } catch (error) {
      console.error("LinkKeep: Failed to save links", error);
      throw new Error("Could not save links to WebDAV.");
    }
  }

  /**
   * Adds a new link to the store.
   */
  async addLink(linkData: Omit<Link, "id" | "addedAt" | "isRead">): Promise<Link> {
    const store = await this.fetchLinks();
    
    const newLink: Link = {
      ...linkData,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
      isRead: false,
      tags: linkData.tags || [],
    };

    store.links.unshift(newLink); // Add to the beginning
    await this.saveLinks(store);
    return newLink;
  }

  /**
   * Updates an existing link.
   */
  async updateLink(id: string, updates: Partial<Omit<Link, "id" | "addedAt">>): Promise<void> {
    const store = await this.fetchLinks();
    const index = store.links.findIndex((l) => l.id === id);
    if (index === -1) throw new Error("Link not found.");

    store.links[index] = { ...store.links[index], ...updates };
    await this.saveLinks(store);
  }

  /**
   * Deletes a link from the store.
   */
  async deleteLink(id: string): Promise<void> {
    const store = await this.fetchLinks();
    store.links = store.links.filter((l) => l.id !== id);
    await this.saveLinks(store);
  }
}

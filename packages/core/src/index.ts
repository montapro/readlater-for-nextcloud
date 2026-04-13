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
  token?: string;
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

  async verifyConnection(): Promise<boolean> {
    try {
      await this.client.getDirectoryContents("/");
      return true;
    } catch (error) {
      console.error("LinkKeep: Connection verification failed", error);
      return false;
    }
  }

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
   * Adds a new link or reactivates an existing read link.
   */
  async addLink(linkData: Omit<Link, "id" | "addedAt" | "isRead">): Promise<Link> {
    const store = await this.fetchLinks();
    
    // Check if URL already exists
    const existingIndex = store.links.findIndex(l => l.url === linkData.url);
    
    if (existingIndex !== -1) {
      const existing = store.links[existingIndex];
      
      // If it's already unread, we just return it (or could throw, but UI prevents this)
      if (!existing.isRead) {
        return existing;
      }

      // If it's read, we reactivate it: mark as unread, update title and date
      existing.isRead = false;
      existing.addedAt = new Date().toISOString();
      existing.title = linkData.title;

      // Move to top
      store.links.splice(existingIndex, 1);
      store.links.unshift(existing);
      
      await this.saveLinks(store);
      return existing;
    }

    // New link
    const newLink: Link = {
      ...linkData,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
      isRead: false,
      tags: linkData.tags || [],
    };

    store.links.unshift(newLink);
    await this.saveLinks(store);
    return newLink;
  }

  async updateLink(id: string, updates: Partial<Omit<Link, "id" | "addedAt">>): Promise<void> {
    const store = await this.fetchLinks();
    const index = store.links.findIndex((l) => l.id === id);
    if (index === -1) throw new Error("Link not found.");

    store.links[index] = { ...store.links[index], ...updates };
    await this.saveLinks(store);
  }

  async deleteLink(id: string): Promise<void> {
    const store = await this.fetchLinks();
    store.links = store.links.filter((l) => l.id !== id);
    await this.saveLinks(store);
  }
}

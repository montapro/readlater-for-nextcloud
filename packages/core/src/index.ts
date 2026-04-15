import { createClient, WebDAVClient, AuthType } from "webdav";
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
  username?: string;
  password?: string;
  token?: string;
}

// --- Client Implementation ---

export class ReadLaterClient {
  private client: WebDAVClient;
  private readonly storagePath = "/ReadLater";
  private readonly fileName = "links.json";

  constructor(config: WebDAVConfig) {
    const options: any = {
      // Use browser session if no credentials provided
      headers: { 
        "Cache-Control": "no-cache", 
        "Pragma": "no-cache" 
      }
    };

    if (config.username && config.password) {
      options.authType = AuthType.Password;
      options.username = config.username;
      options.password = config.password;
    }

    this.client = createClient(config.url, options);
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.client.getDirectoryContents("/", { details: false });
      return true;
    } catch (error: any) {
      console.error("LinkKeep: Connection check failed", error);
      return false;
    }
  }

  async ensureStorageExists(): Promise<void> {
    try {
      if (!(await this.client.exists(this.storagePath))) {
        await this.client.createDirectory(this.storagePath);
      }
    } catch (error) {
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
        headers: { 
          "Cache-Control": "no-cache, no-store, must-revalidate", 
          "Pragma": "no-cache" 
        }
      })) as string;
      
      const data = JSON.parse(content);
      return LinkStoreSchema.parse(data);
    } catch (error) {
      throw new Error("Access denied. Please ensure you are logged into your Nextcloud in this browser.");
    }
  }

  async saveLinks(store: LinkStore): Promise<void> {
    const fullPath = `${this.storagePath}/${this.fileName}`;
    try {
      await this.ensureStorageExists();
      const content = JSON.stringify(store, null, 2);
      await this.client.putFileContents(fullPath, content);
    } catch (error) {
      throw new Error("Could not save to WebDAV. Check permissions or login status.");
    }
  }

  async addLink(linkData: Omit<Link, "id" | "addedAt" | "isRead">): Promise<Link> {
    const store = await this.fetchLinks();
    const existingIndex = store.links.findIndex(l => l.url === linkData.url);
    if (existingIndex !== -1) {
      const existing = store.links[existingIndex];
      if (!existing.isRead) return existing;
      existing.isRead = false;
      existing.addedAt = new Date().toISOString();
      existing.title = linkData.title;
      store.links.splice(existingIndex, 1);
      store.links.unshift(existing);
      await this.saveLinks(store);
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

  async markAllAsRead(): Promise<void> {
    const store = await this.fetchLinks();
    store.links = store.links.map(l => ({ ...l, isRead: true }));
    await this.saveLinks(store);
  }

  async deleteAllLinks(): Promise<void> {
    const store = { version: "1.0", links: [] };
    await this.saveLinks(store);
  }
}

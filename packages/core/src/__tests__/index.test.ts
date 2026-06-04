import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LinkSchema,
  LinkStoreSchema,
  ReadLaterClient,
} from "../index";
import type { Link, LinkStore, WebDAVConfig } from "../index";
import { ZodError } from "zod";

// ---------------------------------------------------------------------------
// Mock the webdav module
// ---------------------------------------------------------------------------

const mockClient = {
  getDirectoryContents: vi.fn(),
  exists: vi.fn(),
  stat: vi.fn(),
  getFileContents: vi.fn(),
  putFileContents: vi.fn(),
  createDirectory: vi.fn(),
  customRequest: vi.fn(),
};

vi.mock("webdav", () => ({
  createClient: vi.fn(() => mockClient),
  AuthType: { Password: 1 },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a Response-like object compatible with the @buttercup/fetch Response API. */
function mockResponse(data: string, etag?: string) {
  return {
    text: () => Promise.resolve(data),
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "etag" ? (etag ?? null) : null,
    },
  };
}

/** Sets up all WebDAV mocks to simulate a store with the given links and etag. */
function mockStore(links: Link[], etag = '"abc123"') {
  mockClient.exists.mockResolvedValue(true);
  mockClient.stat.mockResolvedValue({
    data: { etag, filename: "/ReadLater/links.json", basename: "links.json", lastmod: new Date().toISOString(), size: 100, type: "file" },
    headers: {},
    status: 200,
    statusText: "OK",
  } as any);
  mockClient.getFileContents.mockResolvedValue(JSON.stringify(sampleStore(links)));
  mockClient.putFileContents.mockResolvedValue(true);
}

const validConfig: WebDAVConfig = {
  url: "https://cloud.example.com/remote.php/dav/files/user/",
  username: "user",
  password: "pass",
};

const sampleLink = (overrides: Partial<Link> = {}): Link => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  url: "https://example.com/article",
  title: "Example Article",
  addedAt: "2025-01-15T10:30:00.000Z",
  isRead: false,
  tags: [],
  ...overrides,
});

const sampleStore = (links: Link[] = []): LinkStore => ({
  version: "1.0",
  links,
});

// ---------------------------------------------------------------------------
// Zod schema tests
// ---------------------------------------------------------------------------

describe("LinkSchema", () => {
  it("accepts a valid link", () => {
    const link = sampleLink();
    expect(() => LinkSchema.parse(link)).not.toThrow();
  });

  it("rejects a link with missing id", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...rest } = sampleLink();
    expect(() => LinkSchema.parse(rest)).toThrow(ZodError);
  });

  it("rejects a link with invalid url format", () => {
    expect(() => LinkSchema.parse(sampleLink({ url: "not-a-url" }))).toThrow(
      ZodError
    );
  });

  it("rejects a link with non-UUID id", () => {
    expect(() => LinkSchema.parse(sampleLink({ id: "123" }))).toThrow(ZodError);
  });

  it("applies default values for tags and isRead", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tags, isRead, ...rest } = sampleLink();
    const parsed = LinkSchema.parse(rest);
    expect(parsed.tags).toEqual([]);
    expect(parsed.isRead).toBe(false);
  });

  it("accepts optional description", () => {
    const link = sampleLink({ description: "A great article" });
    const parsed = LinkSchema.parse(link);
    expect(parsed.description).toBe("A great article");
  });

  it("accepts a link without description", () => {
    const link = sampleLink();
    delete link.description;
    const parsed = LinkSchema.parse(link);
    expect(parsed.description).toBeUndefined();
  });
});

describe("LinkStoreSchema", () => {
  it("accepts an empty store", () => {
    const store = sampleStore();
    expect(() => LinkStoreSchema.parse(store)).not.toThrow();
  });

  it("accepts a store with links", () => {
    const store = sampleStore([sampleLink(), sampleLink({ id: "660e8400-e29b-41d4-a716-446655440001", url: "https://example.com/other" })]);
    expect(() => LinkStoreSchema.parse(store)).not.toThrow();
  });

  it("rejects a store with invalid links", () => {
    const store = { version: "1.0", links: [{ invalid: true }] };
    expect(() => LinkStoreSchema.parse(store)).toThrow(ZodError);
  });

  it("rejects a store with missing version", () => {
    expect(() => LinkStoreSchema.parse({ links: [] })).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// ReadLaterClient tests
// ---------------------------------------------------------------------------

describe("ReadLaterClient", () => {
  let client: ReadLaterClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ReadLaterClient(validConfig);
  });

  // -- verifyConnection --

  describe("verifyConnection", () => {
    it("returns ok:true when directory listing succeeds", async () => {
      mockClient.getDirectoryContents.mockResolvedValue([]);
      const result = await client.verifyConnection();
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns ok:false with error message on failure", async () => {
      mockClient.getDirectoryContents.mockRejectedValue(
        new Error("Network error")
      );
      const result = await client.verifyConnection();
      expect(result.ok).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  // -- fetchLinks --

  describe("fetchLinks", () => {
    it("returns empty store when file does not exist", async () => {
      mockClient.exists.mockResolvedValue(false);
      const store = await client.fetchLinks();
      expect(store).toEqual({ version: "1.0", links: [] });
    });

    it("returns parsed store when file exists with valid data", async () => {
      mockClient.exists.mockResolvedValue(true);
      const store = sampleStore([sampleLink()]);
      mockClient.getFileContents.mockResolvedValue(JSON.stringify(store));
      const result = await client.fetchLinks();
      expect(result).toEqual(store);
    });

    it("throws corrupted-data error on invalid JSON", async () => {
      mockClient.exists.mockResolvedValue(true);
      mockClient.getFileContents.mockResolvedValue("{ broken json");
      await expect(client.fetchLinks()).rejects.toThrow(
        /corrupted.*invalid JSON/i
      );
    });

    it("throws invalid-format error on schema mismatch", async () => {
      mockClient.exists.mockResolvedValue(true);
      mockClient.getFileContents.mockResolvedValue(
        JSON.stringify({ version: "1.0", links: [{ notALink: true }] })
      );
      await expect(client.fetchLinks()).rejects.toThrow(
        /invalid format/i
      );
    });

    it("re-throws network errors as-is", async () => {
      mockClient.exists.mockResolvedValue(true);
      mockClient.getFileContents.mockRejectedValue(
        new Error("ECONNREFUSED")
      );
      await expect(client.fetchLinks()).rejects.toThrow("ECONNREFUSED");
    });
  });

  // -- saveLinks --

  describe("saveLinks", () => {
    it("saves a valid store successfully", async () => {
      mockClient.exists.mockResolvedValue(true); // directory already exists
      mockClient.putFileContents.mockResolvedValue(true);
      const store = sampleStore([sampleLink()]);
      await expect(client.saveLinks(store)).resolves.toBeUndefined();
      expect(mockClient.putFileContents).toHaveBeenCalledTimes(1);
    });

    it("rejects an invalid store before saving", async () => {
      // @ts-expect-error – testing runtime validation
      await expect(client.saveLinks({ version: "1.0", links: "not-an-array" })).rejects.toThrow(
        /invalid/i
      );
      expect(mockClient.putFileContents).not.toHaveBeenCalled();
    });

    it("creates storage directory if it does not exist", async () => {
      mockClient.exists.mockResolvedValue(false);
      mockClient.createDirectory.mockResolvedValue(undefined);
      mockClient.putFileContents.mockResolvedValue(true);
      const store = sampleStore();
      await client.saveLinks(store);
      expect(mockClient.createDirectory).toHaveBeenCalled();
    });
  });

  // -- addLink --

  describe("addLink", () => {
    const linkData = { url: "https://example.com/new", title: "New Article", tags: [] };

    beforeEach(() => {
      mockStore([]);
    });

    it("adds a new link at the beginning of the list", async () => {
      const result = await client.addLink(linkData);
      expect(result.url).toBe(linkData.url);
      expect(result.title).toBe(linkData.title);
      expect(result.isRead).toBe(false);
    });

    it("returns existing link unchanged if already saved and unread", async () => {
      const existingLink = sampleLink({ url: linkData.url, isRead: false });
      mockStore([existingLink]);

      const result = await client.addLink(linkData);
      expect(result.isRead).toBe(false);
    });

    it("reactivates a read link when saved again", async () => {
      const readLink = sampleLink({ url: linkData.url, isRead: true, title: "Old Title" });
      mockStore([readLink]);

      const result = await client.addLink(linkData);
      expect(result.isRead).toBe(false);
      expect(result.title).toBe(linkData.title);
    });
  });

  // -- updateLink --

  describe("updateLink", () => {
    const link = sampleLink();

    beforeEach(() => {
      mockStore([link]);
    });

    it("updates an existing link", async () => {
      await expect(
        client.updateLink(link.id, { isRead: true })
      ).resolves.toBeUndefined();
    });

    it("throws when link is not found", async () => {
      await expect(
        client.updateLink("non-existent-id", { isRead: true })
      ).rejects.toThrow("Link not found");
    });
  });

  // -- deleteLink --

  describe("deleteLink", () => {
    const link = sampleLink();

    beforeEach(() => {
      mockStore([link]);
    });

    it("removes a link", async () => {
      await expect(client.deleteLink(link.id)).resolves.toBeUndefined();
    });
  });

  // -- markAllAsRead --

  describe("markAllAsRead", () => {
    const links = [
      sampleLink({ id: "550e8400-e29b-41d4-a716-446655440001", isRead: false }),
      sampleLink({ id: "550e8400-e29b-41d4-a716-446655440002", isRead: false }),
    ];

    beforeEach(() => {
      mockStore(links);
    });

    it("marks all links as read", async () => {
      await expect(client.markAllAsRead()).resolves.toBeUndefined();
      // Verify the saved data has all links marked as read
      const savedArg = mockClient.putFileContents.mock.calls[0][1];
      const saved = JSON.parse(savedArg as string);
      expect(saved.links.every((l: Link) => l.isRead)).toBe(true);
    });
  });

  // -- deleteAllLinks --

  describe("deleteAllLinks", () => {
    beforeEach(() => {
      mockStore([sampleLink()]);
    });

    it("deletes all links", async () => {
      await expect(client.deleteAllLinks()).resolves.toBeUndefined();
      const savedArg = mockClient.putFileContents.mock.calls[0][1];
      const saved = JSON.parse(savedArg as string);
      expect(saved.links).toEqual([]);
    });
  });

  // -- optimistic concurrency (retry on conflict) --

  describe("optimistic concurrency", () => {
    it("retries on HTTP 412 conflict and succeeds on second attempt", async () => {
      let callCount = 0;
      mockStore([]);
      mockClient.putFileContents.mockImplementation(async (_path: string, _data: string) => {
        callCount++;
        if (callCount === 1) {
          const err = new Error("Precondition Failed") as any;
          err.status = 412;
          throw err;
        }
        return true;
      });

      const result = await client.addLink({
        url: "https://example.com/new",
        title: "Test",
        tags: [],
      });
      expect(result.url).toBe("https://example.com/new");
      expect(callCount).toBe(2);
    });

    it("throws after exhausting retries on persistent 412", async () => {
      mockStore([]);
      mockClient.putFileContents.mockRejectedValue(
        Object.assign(new Error("Precondition Failed"), { status: 412 })
      );

      await expect(
        client.addLink({
          url: "https://example.com/fail",
          title: "Fail",
          tags: [],
        })
      ).rejects.toThrow(/modified by another client/i);
    });
  });
});

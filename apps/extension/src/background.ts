import browser from "webextension-polyfill";
import { ReadLaterClient, WebDAVConfig, Link } from "@readlater/core";

/**
 * Updates the extension icon (badge) based on whether the current URL is already saved.
 */
async function updateTabBadge(tabId: number, url?: string) {
  if (!url) {
    browser.action.setBadgeText({ text: "", tabId });
    return;
  }

  const data = await browser.storage.local.get(["links_cache"]);
  const links = (data.links_cache as Link[]) || [];
  
  const isSavedAndUnread = links.some(l => l.url === url && !l.isRead);
  
  if (isSavedAndUnread) {
    browser.action.setBadgeBackgroundColor({ color: "#10b981", tabId });
    browser.action.setBadgeText({ text: "✓", tabId });
  } else {
    browser.action.setBadgeText({ text: "", tabId });
  }
}

/**
 * Syncs links from WebDAV and updates the cache.
 */
async function syncLinks() {
  const data = await browser.storage.local.get(["webdav_url", "webdav_user", "webdav_pass"]);
  if (data.webdav_url) {
    try {
      const config: WebDAVConfig = {
        url: data.webdav_url as string,
        username: data.webdav_user as string,
        password: (data.webdav_pass as string) || ""
      };
      const client = new ReadLaterClient(config);
      const store = await client.fetchLinks();
      
      await browser.storage.local.set({ links_cache: store.links });
      
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (activeTab?.id) {
        updateTabBadge(activeTab.id, activeTab.url);
      }
    } catch (err) {
      console.error("ReadLater: Background sync failed", err);
    }
  }
}

// Listen for tab changes
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    updateTabBadge(tabId, tab.url);
  }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  updateTabBadge(activeInfo.tabId, tab.url);
});

// React to storage changes – re-sync when config changes
browser.storage.onChanged.addListener((changes) => {
  if (changes.webdav_url || changes.webdav_user || changes.webdav_pass) {
    syncLinks();
  }
  if (changes.links_cache) {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        updateTabBadge(activeTab.id, activeTab.url);
      }
    });
  }
});

browser.runtime.onInstalled.addListener(() => syncLinks());
browser.runtime.onStartup.addListener(() => syncLinks());

browser.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as { type?: string };
  if (msg.type === "SYNC_LINKS") {
    syncLinks();
  }
});

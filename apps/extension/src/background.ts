import browser from "webextension-polyfill";
import { LinkKeepClient, WebDAVConfig, Link } from "@linkkeep/core";

/**
 * Updates the extension icon (badge) based on whether the current URL is already saved.
 */
async function updateTabBadge(tabId: number, url?: string) {
  if (!url) {
    browser.action.setBadgeText({ text: "", tabId });
    return;
  }

  // Use cached links from storage to avoid WebDAV overhead on every tab change
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

// Listen for tab updates (loading new page, typing URL)
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    updateTabBadge(tabId, tab.url);
  }
});

// Listen for tab activation (switching between existing tabs)
browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  updateTabBadge(activeInfo.tabId, tab.url);
});

// Periodic background sync
async function syncLinks() {
  const data = await browser.storage.local.get(["webdav_url", "webdav_user", "webdav_pass"]);
  if (data.webdav_url && data.webdav_user) {
    try {
      const config: WebDAVConfig = {
        url: data.webdav_url as string,
        username: data.webdav_user as string,
        password: (data.webdav_pass as string) || ""
      };
      const client = new LinkKeepClient(config);
      const store = await client.fetchLinks();
      
      // Store in cache
      await browser.storage.local.set({ links_cache: store.links });
      
      // Update badge for current tab after sync
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      if (activeTab?.id) {
        updateTabBadge(activeTab.id, activeTab.url);
      }
    } catch (err) {
      console.error("LinkKeep: Background sync failed", err);
    }
  }
}

// Sync on startup/install
browser.runtime.onInstalled.addListener(() => syncLinks());
browser.runtime.onStartup.addListener(() => syncLinks());

// Listen for messages from the popup
browser.runtime.onMessage.addListener((message: any) => {
  if (message.type === "SYNC_LINKS") {
    syncLinks();
  }
});

import React, { useState, useEffect } from "react";
import { LinkKeepClient, WebDAVConfig } from "@linkkeep/core";

export default function App() {
  const [config, setConfig] = useState<WebDAVConfig>({
    url: "",
    username: "",
    password: "",
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [currentTab, setCurrentTab] = useState<{ url?: string; title?: string }>({});
  const [status, setStatus] = useState<string>("");

  // Load config on mount
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["webdav_url", "webdav_user", "webdav_pass"], (result: { [key: string]: any }) => {
        if (result.webdav_url && result.webdav_user) {
          const loadedConfig: WebDAVConfig = {
            url: result.webdav_url as string,
            username: result.webdav_user as string,
            password: (result.webdav_pass as string) || "",
          };
          setConfig(loadedConfig);
          setIsConfigured(true);
        }
      });
    }

    // Get active tab info
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab) {
          setCurrentTab({ url: activeTab.url, title: activeTab.title });
        }
      });
    }
  }, []);

  const saveConfig = () => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set(
        {
          webdav_url: config.url,
          webdav_user: config.username,
          webdav_pass: config.password,
        },
        () => {
          setIsConfigured(true);
          setStatus("Configuration saved!");
        }
      );
    }
  };

  const saveCurrentLink = async () => {
    if (!currentTab.url || !currentTab.title) {
      setStatus("No active tab found.");
      return;
    }

    setStatus("Saving...");
    try {
      const client = new LinkKeepClient(config);
      await client.addLink({
        url: currentTab.url,
        title: currentTab.title,
        tags: [],
      });
      setStatus("Link saved successfully!");
    } catch (error) {
      console.error(error);
      setStatus("Error saving link. Check your WebDAV settings.");
    }
  };

  return (
    <div style={{ padding: "16px", background: "#f9fafb", minHeight: "200px" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: "bold", margin: "0 0 16px 0" }}>LinkKeep</h1>

      {!isConfigured ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input
            placeholder="WebDAV URL (e.g., https://cloud.com/remote.php/dav/files/user/)"
            value={config.url}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
            style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
          />
          <input
            placeholder="Username"
            value={config.username}
            onChange={(e) => setConfig({ ...config, username: e.target.value })}
            style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
          />
          <input
            type="password"
            placeholder="Password / App Password"
            value={config.password}
            onChange={(e) => setConfig({ ...config, password: e.target.value })}
            style={{ padding: "8px", border: "1px solid #d1d5db", borderRadius: "4px" }}
          />
          <button
            onClick={saveConfig}
            style={{
              padding: "10px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Save Configuration
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "0.875rem", color: "#4b5563" }}>
            <strong>Ready to save:</strong>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentTab.title || "Loading..." }
            </div>
          </div>
          
          <button
            onClick={saveCurrentLink}
            style={{
              padding: "10px",
              background: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "600"
            }}
          >
            Save this Link
          </button>

          <button
            onClick={() => setIsConfigured(false)}
            style={{
              fontSize: "0.75rem",
              background: "transparent",
              border: "none",
              color: "#6b7280",
              textDecoration: "underline",
              cursor: "pointer",
              marginTop: "10px"
            }}
          >
            Edit WebDAV Settings
          </button>
        </div>
      )}

      {status && (
        <div style={{ marginTop: "12px", fontSize: "0.875rem", color: status.includes("Error") ? "#ef4444" : "#10b981" }}>
          {status}
        </div>
      )}
    </div>
  );
}

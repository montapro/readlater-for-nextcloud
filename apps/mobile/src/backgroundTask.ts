import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { ReadLaterClient, WebDAVConfig } from "@readlater/core";
import "./polyfills";

export const BACKGROUND_SYNC_TASK = "readlater-background-sync";

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    const [url, user, pass] = await Promise.all([
      SecureStore.getItemAsync("webdav_url"),
      SecureStore.getItemAsync("webdav_user"),
      SecureStore.getItemAsync("webdav_pass"),
    ]);

    if (!url) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const config: WebDAVConfig = {
      url,
      username: user ?? "",
      password: pass ?? "",
    };

    const client = new ReadLaterClient(config);
    const store = await client.fetchLinks();

    await SecureStore.setItemAsync("links_cache", JSON.stringify(store.links));

    const unreadCount = store.links.filter((link) => !link.isRead).length;
    try {
      await Notifications.setBadgeCountAsync(unreadCount);
    } catch (_err) {
      // Badge update is best-effort in the background
    }

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error("ReadLater: background sync failed", error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSyncAsync(
  minimumInterval: number
): Promise<void> {
  try {
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval,
    });
  } catch (error) {
    console.error("ReadLater: failed to register background sync", error);
  }
}

export async function unregisterBackgroundSyncAsync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_SYNC_TASK
    );
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    }
  } catch (error) {
    console.error("ReadLater: failed to unregister background sync", error);
  }
}

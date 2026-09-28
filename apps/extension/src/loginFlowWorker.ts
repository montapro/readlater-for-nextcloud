import browser from "webextension-polyfill";
import {
  startLoginFlow,
  pollLoginFlow,
  fetchUid,
  type NextcloudLoginFlowResult,
} from "./utils/loginFlow";

export type LoginFlowPhase = "starting" | "waiting" | "finishing";

export interface LoginFlowProgress {
  type: "LOGIN_FLOW_PROGRESS";
  phase: LoginFlowPhase;
}

export interface LoginFlowResultMessage {
  type: "LOGIN_FLOW_RESULT";
  result: NextcloudLoginFlowResult;
}

export interface LoginFlowErrorMessage {
  type: "LOGIN_FLOW_ERROR";
  error: string;
}

type LoginFlowMessage =
  | LoginFlowProgress
  | LoginFlowResultMessage
  | LoginFlowErrorMessage;

let running = false;

export const LOGIN_STATUS_KEY = "nc_login_status";
export const LOGIN_ERROR_KEY = "nc_login_error";

async function persistStatus(
  status: LoginFlowPhase | "idle",
  error?: string
): Promise<void> {
  if (status === "idle") {
    await browser.storage.local.remove([LOGIN_STATUS_KEY, LOGIN_ERROR_KEY]);
    return;
  }
  await browser.storage.local.set({
    [LOGIN_STATUS_KEY]: status,
    [LOGIN_ERROR_KEY]: error || "",
  });
}

export async function runLoginFlow(instance: string): Promise<void> {
  if (running) {
    broadcast({ type: "LOGIN_FLOW_ERROR", error: "Login flow already running." });
    return;
  }
  running = true;

  const progress = async (phase: LoginFlowPhase) => {
    await persistStatus(phase);
    broadcast({ type: "LOGIN_FLOW_PROGRESS", phase } satisfies LoginFlowMessage);
  };

  try {
    console.log("ReadLater: login flow starting for", instance);
    await progress("starting");
    const flow = await startLoginFlow(instance);
    console.log("ReadLater: login URL:", flow.loginUrl);
    await browser.tabs.create({ url: flow.loginUrl, active: true });

    await progress("waiting");
    console.log("ReadLater: polling", flow.pollEndpoint);
    const credentials = await pollLoginFlow(flow.pollEndpoint, flow.pollToken);
    console.log("ReadLater: flow done, resolving UID for", credentials.loginName);

    await progress("finishing");
    const uid = await fetchUid(
      credentials.server,
      credentials.loginName,
      credentials.appPassword
    );
    console.log("ReadLater: resolved UID:", uid);

    const result: NextcloudLoginFlowResult = { ...credentials, uid };
    await browser.storage.local.set({
      nc_server: result.server,
      nc_username: result.loginName,
      nc_apppw: result.appPassword,
      nc_uid: result.uid,
    });

    broadcast({ type: "LOGIN_FLOW_RESULT", result });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Login flow failed.";
    console.error("ReadLater: login flow failed:", error, err);
    broadcast({ type: "LOGIN_FLOW_ERROR", error });
  } finally {
    await persistStatus("idle");
    running = false;
  }
}

function broadcast(message: LoginFlowMessage): void {
  browser.runtime.sendMessage(message).catch(() => {
    // No popup listening – progress is best-effort.
  });
}

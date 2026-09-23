import type { RefreshInterval } from "./types";

export interface RefreshIntervalOption {
  value: RefreshInterval;
  label: string;
  ms: number | null;
}

export const REFRESH_INTERVAL_OPTIONS: RefreshIntervalOption[] = [
  { value: "1min", label: "1 min", ms: 60_000 },
  { value: "5min", label: "5 min", ms: 300_000 },
  { value: "15min", label: "15 min", ms: 900_000 },
  { value: "60min", label: "1 hour", ms: 3_600_000 },
  { value: "manual", label: "Manual", ms: null },
];

export const DEFAULT_REFRESH_INTERVAL: RefreshInterval = "5min";

export function intervalToMs(interval: RefreshInterval): number | null {
  return REFRESH_INTERVAL_OPTIONS.find((o) => o.value === interval)?.ms ?? null;
}

export function intervalToBackgroundSeconds(
  interval: RefreshInterval
): number | null {
  if (interval === "manual") return null;
  if (interval === "60min") return 3600;
  // iOS Background Fetch minimum is ~15 minutes, so shorter intervals are
  // clamped to 15 minutes for the background task (the exact timer runs in-app).
  return 900;
}

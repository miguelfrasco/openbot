import { usageQuotaForModel } from "@openbot/contracts/agent-providers";
import type { AccountUsageLimit, AccountUsageWindow } from "@openbot/contracts/ipc";
import { usageWindowResetSince } from "../account-usage";

export const AUTO_QUOTA_SNAPSHOT_MAX_AGE_MS = 30 * 60_000;

export interface CachedUsageSnapshot {
  limit: AccountUsageLimit;
  readAt: number;
}

function windowDurationMs(window: AccountUsageWindow | null | undefined): number | null {
  const minutes = window?.windowDurationMins;
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return null;
  return minutes * 60_000;
}

function windowStale(window: AccountUsageWindow | null | undefined, readAt: number, now: number): boolean {
  const durationMs = windowDurationMs(window);
  if (durationMs === null) return false;
  return readAt + durationMs < now;
}

function pushWindow(
  percents: number[],
  window: AccountUsageWindow | null | undefined,
  readAt: number,
  now: number,
): void {
  if (!window || windowStale(window, readAt, now)) return;
  percents.push(window.usedPercent);
}

function collectUsedPercents(limit: AccountUsageLimit, model: string | null, readAt: number, now: number): number[] {
  const scoped = model ? usageQuotaForModel(limit, model) : null;
  const percents: number[] = [];
  const primary = scoped?.primary ?? limit.primary;
  const secondary = scoped?.secondary ?? limit.secondary;
  pushWindow(percents, primary, readAt, now);
  pushWindow(percents, secondary, readAt, now);
  pushWindow(percents, limit.tertiary ?? null, readAt, now);
  const groups = limit.groups ?? [];
  for (const group of groups) {
    if (model && group.models.length > 0 && !group.models.some((listed) => listed === model)) continue;
    pushWindow(percents, group.primary, readAt, now);
    pushWindow(percents, group.secondary, readAt, now);
  }
  return percents;
}

export function quotaUsedPercentFromSnapshot(
  snapshot: CachedUsageSnapshot | null,
  model: string | null,
  now = Date.now(),
  maxAgeMs = AUTO_QUOTA_SNAPSHOT_MAX_AGE_MS,
): number | null {
  if (!snapshot) return null;
  if (now - snapshot.readAt > maxAgeMs) return null;
  if (usageWindowResetSince(snapshot.limit, snapshot.readAt)) return null;
  const percents = collectUsedPercents(snapshot.limit, model, snapshot.readAt, now);
  return percents.length > 0 ? Math.max(...percents) : null;
}

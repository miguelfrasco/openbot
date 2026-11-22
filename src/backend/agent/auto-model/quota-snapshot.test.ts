import type { AccountUsageLimit } from "@openbot/contracts/ipc";
import { describe, expect, it } from "vitest";
import { AUTO_QUOTA_SNAPSHOT_MAX_AGE_MS, quotaUsedPercentFromSnapshot } from "./quota-snapshot";
import { applyQuotaStepDown } from "./tiers";

const baseLimit = (usedPercent: number, windowDurationMins = 300): AccountUsageLimit => ({
  id: "codex",
  primary: { usedPercent, windowDurationMins, resetsAt: null },
  secondary: null,
});

describe("quotaUsedPercentFromSnapshot", () => {
  const now = 1_700_000_000_000;

  it("returns the highest fresh window percent", () => {
    const snapshot = {
      readAt: now - 60_000,
      limit: {
        id: "claude",
        primary: { usedPercent: 72, windowDurationMins: 300, resetsAt: null },
        secondary: { usedPercent: 88, windowDurationMins: 300, resetsAt: null },
      },
    };
    expect(quotaUsedPercentFromSnapshot(snapshot, null, now)).toBe(88);
  });

  it("ignores snapshots older than 30 minutes", () => {
    const snapshot = { readAt: now - AUTO_QUOTA_SNAPSHOT_MAX_AGE_MS - 1, limit: baseLimit(91) };
    expect(quotaUsedPercentFromSnapshot(snapshot, null, now)).toBeNull();
  });

  it("ignores snapshots after the usage window reset", () => {
    const snapshot = {
      readAt: now - 120_000,
      limit: {
        id: "codex",
        primary: { usedPercent: 90, windowDurationMins: 60, resetsAt: (now - 60_000) / 1_000 },
        secondary: null,
      },
    };
    expect(quotaUsedPercentFromSnapshot(snapshot, null, now)).toBeNull();
  });

  it("ignores windows whose duration ended before now", () => {
    const snapshot = {
      readAt: now - 40 * 60_000,
      limit: baseLimit(85, 30),
    };
    expect(quotaUsedPercentFromSnapshot(snapshot, null, now)).toBeNull();
  });
});

describe("applyQuotaStepDown", () => {
  it("steps down one tier from 80 percent", () => {
    expect(applyQuotaStepDown(3, 82, 4)).toBe(2);
  });

  it("uses the cheapest tier from 95 percent", () => {
    expect(applyQuotaStepDown(3, 96, 4)).toBe(0);
  });
});

import type { AgentModelOption, AgentReasoningEffort } from "@openbot/contracts/ipc";
import type { AgentProvider } from "../../agent-client";
import { EXCLUDED_AUTO_MODEL_IDS } from "./constants";

export interface AutoTierChoice {
  modelId: string;
  effort: AgentReasoningEffort;
}

interface TierPattern {
  readonly family: readonly string[];
  readonly effort: AgentReasoningEffort;
}

const CLAUDE_TIERS: readonly TierPattern[] = [
  { family: ["claude-haiku"], effort: "low" },
  { family: ["claude-sonnet"], effort: "medium" },
  { family: ["claude-sonnet"], effort: "high" },
  { family: ["claude-opus"], effort: "high" },
];

const CODEX_TIERS: readonly TierPattern[] = [
  { family: ["gpt-6-luna", "gpt-5.6-luna", "gpt-5-luna"], effort: "low" },
  { family: ["gpt-5.6-terra", "gpt-6-terra", "gpt-5-terra"], effort: "medium" },
  { family: ["gpt-5.6-sol", "gpt-6-sol", "gpt-5-sol"], effort: "medium" },
  { family: ["gpt-5.6-sol", "gpt-6-sol", "gpt-5-sol"], effort: "high" },
];

function modelAllowed(model: AgentModelOption): boolean {
  const id = model.id.toLowerCase();
  if (EXCLUDED_AUTO_MODEL_IDS.has(id)) return false;
  if (id.includes("fable")) return false;
  return true;
}

function pickFamilyModel(models: readonly AgentModelOption[], families: readonly string[]): AgentModelOption | null {
  for (const family of families) {
    const match = models.find(
      (candidate) =>
        modelAllowed(candidate) &&
        (candidate.id.toLowerCase() === family ||
          candidate.id.toLowerCase().startsWith(`${family}-`) ||
          candidate.id.toLowerCase().startsWith(`${family}[`)),
    );
    if (match) return match;
  }
  const loose = families.map((family) => family.replace(/\d/gu, ""));
  return (
    models.find(
      (candidate) => modelAllowed(candidate) && loose.some((family) => candidate.id.toLowerCase().includes(family)),
    ) ?? null
  );
}

export function buildTierLadder(
  provider: AgentProvider,
  models: readonly AgentModelOption[],
): readonly AutoTierChoice[] {
  const own = models.filter((model) => model.provider === provider);
  const patterns = provider === "claude" ? CLAUDE_TIERS : provider === "codex" ? CODEX_TIERS : [];
  const ladder: AutoTierChoice[] = [];
  for (const pattern of patterns) {
    const picked = pickFamilyModel(own, pattern.family);
    if (!picked) continue;
    const effort = picked.supportedReasoningEfforts.includes(pattern.effort)
      ? pattern.effort
      : picked.defaultReasoningEffort;
    const next = { modelId: picked.id, effort };
    if (ladder.some((entry) => entry.modelId === next.modelId && entry.effort === next.effort)) continue;
    ladder.push(next);
  }
  return ladder.length > 0
    ? ladder
    : own
        .filter(modelAllowed)
        .slice(0, 1)
        .map((model) => ({
          modelId: model.id,
          effort: model.defaultReasoningEffort,
        }));
}

export function tierIndexForComplexity(complexity: number, depth: number): number {
  if (depth <= 1) return 0;
  if (complexity < 24) return 0;
  if (complexity < 46) return Math.min(1, depth - 1);
  if (complexity < 68) return Math.min(2, depth - 1);
  return depth - 1;
}

export function applyQuotaStepDown(index: number, usedPercent: number | null, depth: number): number {
  if (usedPercent !== null && usedPercent >= 95) return 0;
  if (usedPercent !== null && usedPercent >= 80) return Math.max(0, Math.min(depth - 1, index - 1));
  return Math.max(0, Math.min(depth - 1, index));
}

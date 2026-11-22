import type { AgentProvider } from "../../agent-client";

export const AUTO_MODEL_ID = "auto" as const;

export const AUTO_MODEL_PROVIDERS = new Set<AgentProvider>(["claude", "codex"]);

export function isAutoModelId(model: string | null | undefined): boolean {
  return model?.trim().toLowerCase() === AUTO_MODEL_ID;
}

export const EXCLUDED_AUTO_MODEL_IDS = new Set([
  "claude-fable-5",
  "claude-fable-5-1",
  "claude-fable-5-2",
  "claude-fable-5-2-high",
]);

export const AUTO_CLASSIFY_BORDERLINE_LOW = 42;
export const AUTO_CLASSIFY_BORDERLINE_HIGH = 58;

export function autoModelClassificationEnabled(): boolean {
  const raw = process.env.OPENBOT_AUTO_CLASSIFY?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

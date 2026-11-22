import type { AgentModelOption } from "@openbot/contracts/ipc";
import { registerPublicValues } from "@openbot/logging";
import type { AgentProvider } from "../../agent-client";
import { AUTO_MODEL_ID, AUTO_MODEL_PROVIDERS } from "./constants";

registerPublicValues([AUTO_MODEL_ID]);

function autoOption(provider: AgentProvider): AgentModelOption {
  const name = provider === "claude" ? "Claude Auto" : provider === "codex" ? "Codex Auto" : "Auto";
  return {
    provider,
    id: AUTO_MODEL_ID,
    name,
    description: "OpenBot picks an efficient model and reasoning level for each turn.",
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: ["medium"],
    reasoningEffortConfigurable: false,
    listing: "new",
  };
}

export function mergeAutoModelOptions(models: readonly AgentModelOption[]): AgentModelOption[] {
  const merged = [...models];
  for (const provider of AUTO_MODEL_PROVIDERS) {
    if (merged.some((model) => model.provider === provider && model.id === AUTO_MODEL_ID)) continue;
    if (!merged.some((model) => model.provider === provider)) continue;
    merged.unshift(autoOption(provider));
  }
  return merged;
}

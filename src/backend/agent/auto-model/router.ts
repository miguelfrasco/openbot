import type { AgentModelOption, AgentReasoningEffort } from "@openbot/contracts/ipc";
import { createOpenBotLogger } from "@openbot/logging";
import type { AgentProvider } from "../../agent-client";
import { classificationTieBreak, scoreTurnComplexity, type TurnHeuristicInput } from "./heuristics";
import type { AutoModelStickiness } from "./stickiness";
import { type AutoTierChoice, applyQuotaStepDown, buildTierLadder, tierIndexForComplexity } from "./tiers";

const logger = createOpenBotLogger("auto-model");

export interface ResolveAutoTurnInput {
  provider: AgentProvider;
  agentId: string;
  threadId: string;
  models: readonly AgentModelOption[];
  heuristics: TurnHeuristicInput;
  newTask: boolean;
  quotaUsedPercent: number | null;
  blockedModels: ReadonlySet<string>;
  stickiness: AutoModelStickiness;
}

export interface ResolvedAutoTurn {
  modelId: string;
  effort: AgentReasoningEffort;
  tierIndex: number;
  reasons: string[];
}

export function resolveAutoTurn(input: ResolveAutoTurnInput): ResolvedAutoTurn {
  const ladder = buildTierLadder(input.provider, input.models);
  const reasons: string[] = [];
  if (ladder.length === 0) {
    const fallback = input.models.find((model) => model.provider === input.provider);
    if (!fallback) throw new Error("Auto model could not find a provider model.");
    return {
      modelId: fallback.id,
      effort: fallback.defaultReasoningEffort,
      tierIndex: 0,
      reasons: ["empty_ladder"],
    };
  }
  const scored = scoreTurnComplexity(input.heuristics);
  const complexity = classificationTieBreak(scored.complexity);
  reasons.push(...scored.reasons);
  let tierIndex = tierIndexForComplexity(complexity, ladder.length);
  tierIndex = input.stickiness.resolveTierIndex(input.agentId, input.threadId, tierIndex, ladder.length, input.newTask);
  tierIndex = applyQuotaStepDown(tierIndex, input.quotaUsedPercent, ladder.length);
  const pick = (index: number): AutoTierChoice => {
    const slot = ladder[Math.max(0, Math.min(index, ladder.length - 1))];
    if (!slot) throw new Error("Auto model tier ladder is empty.");
    return slot;
  };
  let choice: AutoTierChoice = pick(tierIndex);
  while (input.blockedModels.has(choice.modelId) && tierIndex > 0) {
    tierIndex -= 1;
    choice = pick(tierIndex);
  }
  input.stickiness.noteTurnStart(input.agentId, input.threadId, tierIndex, choice, input.newTask);
  if (input.quotaUsedPercent !== null) reasons.push(`quota_${input.quotaUsedPercent}`);
  reasons.push(`tier_${tierIndex}`, `model_${choice.modelId}`, `effort_${choice.effort}`);
  logger.debug?.("Auto model resolved a turn.", {
    agentId: input.agentId,
    threadId: input.threadId,
    tierIndex,
    modelId: choice.modelId,
    effort: choice.effort,
    reasons,
  });
  return { modelId: choice.modelId, effort: choice.effort, tierIndex, reasons };
}

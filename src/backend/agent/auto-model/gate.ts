import { accountUsageCoversModel } from "@openbot/contracts/agent-providers";
import type { AgentModelOption, AgentReasoningEffort, AgentSummary } from "@openbot/contracts/ipc";
import { providerForAgent } from "../thread-items";
import { mergeAutoModelOptions } from "./catalog";
import { AUTO_MODEL_ID, AUTO_MODEL_PROVIDERS, isAutoModelId } from "./constants";
import { resolveAutoTurn } from "./router";
import { AutoModelStickiness } from "./stickiness";

export interface AutoModelTurnContext {
  agentId: string;
  threadId: string;
  text: string;
  attachmentCount: number;
  priorTurnCount: number;
  contextChars: number;
  newTask: boolean;
}

export interface AutoModelQuotaState {
  usedPercent: number | null;
  blockedModels: ReadonlySet<string>;
}

export class AutoModelGate {
  readonly #stickiness = new AutoModelStickiness();
  readonly #listModels: () => AgentModelOption[];
  readonly #quotaForAgent: (agent: AgentSummary) => AutoModelQuotaState;

  constructor(options: {
    listModels: () => AgentModelOption[];
    quotaForAgent: (agent: AgentSummary) => AutoModelQuotaState;
  }) {
    this.#listModels = options.listModels;
    this.#quotaForAgent = options.quotaForAgent;
  }

  listWithAuto(models: readonly AgentModelOption[]): AgentModelOption[] {
    return mergeAutoModelOptions(models);
  }

  isAuto(agent: AgentSummary): boolean {
    const provider = providerForAgent(agent);
    return (
      isAutoModelId(agent.model) && AUTO_MODEL_PROVIDERS.has(provider) && accountUsageCoversModel(provider, agent.model)
    );
  }

  resolveTurn(
    agent: AgentSummary,
    context: AutoModelTurnContext,
  ): { model: string; effort: AgentReasoningEffort } | null {
    const provider = providerForAgent(agent);
    if (!this.isAuto(agent)) return null;
    const models = this.#listModels();
    const quota = this.#quotaForAgent(agent);
    const resolved = resolveAutoTurn({
      provider,
      agentId: agent.id,
      threadId: context.threadId,
      models,
      heuristics: {
        text: context.text,
        attachmentCount: context.attachmentCount,
        priorTurnCount: context.priorTurnCount,
        contextChars: context.contextChars,
      },
      newTask: context.newTask,
      quotaUsedPercent: quota.usedPercent,
      blockedModels: quota.blockedModels,
      stickiness: this.#stickiness,
    });
    return { model: resolved.modelId, effort: resolved.effort };
  }

  noteTurnFailure(agentId: string, threadId: string, model: string): void {
    if (model === AUTO_MODEL_ID) return;
    this.#stickiness.noteFailure(agentId, threadId);
  }

  forgetAgent(agentId: string): void {
    this.#stickiness.forgetAgent(agentId);
  }
}

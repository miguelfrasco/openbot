import type { AgentModelOption } from "@openbot/contracts/ipc";
import { describe, expect, it } from "vitest";
import { resolveAutoTurn } from "./router";
import { AutoModelStickiness } from "./stickiness";

const claudeModels: AgentModelOption[] = [
  {
    provider: "claude",
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    description: "",
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: ["low", "medium"],
  },
  {
    provider: "claude",
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    description: "",
    defaultReasoningEffort: "high",
    supportedReasoningEfforts: ["low", "medium", "high"],
  },
  {
    provider: "claude",
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    description: "",
    defaultReasoningEffort: "high",
    supportedReasoningEfforts: ["low", "medium", "high"],
  },
  {
    provider: "claude",
    id: "claude-fable-5",
    name: "Claude Fable 5",
    description: "",
    defaultReasoningEffort: "high",
    supportedReasoningEfforts: ["high"],
  },
];

const codexModels: AgentModelOption[] = [
  {
    provider: "codex",
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    description: "",
    defaultReasoningEffort: "low",
    supportedReasoningEfforts: ["low", "medium", "high"],
  },
  {
    provider: "codex",
    id: "gpt-5.6-terra",
    name: "GPT-5.6 Terra",
    description: "",
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: ["low", "medium", "high"],
  },
  {
    provider: "codex",
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    description: "",
    defaultReasoningEffort: "medium",
    supportedReasoningEfforts: ["low", "medium", "high", "max"],
  },
];

describe("resolveAutoTurn", () => {
  it("picks a small Claude tier for a short prompt", () => {
    const stickiness = new AutoModelStickiness();
    const resolved = resolveAutoTurn({
      provider: "claude",
      agentId: "a1",
      threadId: "t1",
      models: claudeModels,
      heuristics: { text: "hi", attachmentCount: 0, priorTurnCount: 0, contextChars: 0 },
      newTask: true,
      quotaUsedPercent: null,
      blockedModels: new Set(),
      stickiness,
    });
    expect(resolved.modelId).toBe("claude-haiku-5-5");
    expect(resolved.effort).toBe("low");
  });

  it("picks a higher Claude tier for architecture work", () => {
    const stickiness = new AutoModelStickiness();
    const resolved = resolveAutoTurn({
      provider: "claude",
      agentId: "a1",
      threadId: "t2",
      models: claudeModels,
      heuristics: {
        text: "Design the architecture for a migration across services with stack traces attached.",
        attachmentCount: 2,
        priorTurnCount: 4,
        contextChars: 4_000,
      },
      newTask: true,
      quotaUsedPercent: null,
      blockedModels: new Set(),
      stickiness,
    });
    expect(resolved.modelId).toMatch(/claude-(sonnet|opus)/u);
  });

  it("never selects Claude Fable", () => {
    const stickiness = new AutoModelStickiness();
    const resolved = resolveAutoTurn({
      provider: "claude",
      agentId: "a1",
      threadId: "t3",
      models: claudeModels,
      heuristics: {
        text: "quick question",
        attachmentCount: 0,
        priorTurnCount: 0,
        contextChars: 0,
      },
      newTask: true,
      quotaUsedPercent: null,
      blockedModels: new Set(),
      stickiness,
    });
    expect(resolved.modelId).not.toContain("fable");
  });

  it("steps down when quota is almost full", () => {
    const stickiness = new AutoModelStickiness();
    const resolved = resolveAutoTurn({
      provider: "claude",
      agentId: "a1",
      threadId: "t4",
      models: claudeModels,
      heuristics: {
        text: "Refactor the payment module and run the full test suite.",
        attachmentCount: 0,
        priorTurnCount: 2,
        contextChars: 2_000,
      },
      newTask: true,
      quotaUsedPercent: 96,
      blockedModels: new Set(),
      stickiness,
    });
    expect(resolved.tierIndex).toBe(0);
    expect(resolved.modelId).toBe("claude-haiku-5-5");
  });

  it("escalates after a recorded failure", () => {
    const stickiness = new AutoModelStickiness();
    stickiness.noteTurnStart("a1", "t5", 0, { modelId: "claude-haiku-5-5", effort: "low" }, true);
    stickiness.noteFailure("a1", "t5");
    const resolved = resolveAutoTurn({
      provider: "claude",
      agentId: "a1",
      threadId: "t5",
      models: claudeModels,
      heuristics: { text: "ok", attachmentCount: 0, priorTurnCount: 1, contextChars: 0 },
      newTask: false,
      quotaUsedPercent: null,
      blockedModels: new Set(),
      stickiness,
    });
    expect(resolved.modelId).not.toBe("claude-haiku-5-5");
  });

  it("avoids models blocked by usage limits", () => {
    const stickiness = new AutoModelStickiness();
    const resolved = resolveAutoTurn({
      provider: "codex",
      agentId: "a1",
      threadId: "t6",
      models: codexModels,
      heuristics: {
        text: "Ship the Docker image to production",
        attachmentCount: 0,
        priorTurnCount: 0,
        contextChars: 0,
      },
      newTask: true,
      quotaUsedPercent: null,
      blockedModels: new Set(["gpt-5.6-sol", "gpt-5.6-terra"]),
      stickiness,
    });
    expect(resolved.modelId).toBe("gpt-6-luna");
  });
});

import type { AutoTierChoice } from "./tiers";

export interface ThreadAutoState {
  tierIndex: number;
  lastChoice: AutoTierChoice | null;
  escalateNext: boolean;
  taskGeneration: number;
}

export class AutoModelStickiness {
  readonly #threads = new Map<string, ThreadAutoState>();

  #key(agentId: string, threadId: string): string {
    return `${agentId}\0${threadId}`;
  }

  read(agentId: string, threadId: string): ThreadAutoState | null {
    return this.#threads.get(this.#key(agentId, threadId)) ?? null;
  }

  resolveTierIndex(agentId: string, threadId: string, heuristicIndex: number, depth: number, newTask: boolean): number {
    const key = this.#key(agentId, threadId);
    const previous = this.#threads.get(key);
    if (!previous) return heuristicIndex;
    if (previous.escalateNext) return Math.min(previous.tierIndex + 1, depth - 1);
    if (!newTask && heuristicIndex < previous.tierIndex) return previous.tierIndex;
    return heuristicIndex;
  }

  noteTurnStart(agentId: string, threadId: string, tierIndex: number, choice: AutoTierChoice, newTask: boolean): void {
    const key = this.#key(agentId, threadId);
    const previous = this.#threads.get(key);
    const taskGeneration = newTask ? (previous?.taskGeneration ?? 0) + 1 : (previous?.taskGeneration ?? 0);
    this.#threads.set(key, {
      tierIndex,
      lastChoice: choice,
      escalateNext: false,
      taskGeneration,
    });
  }

  noteFailure(agentId: string, threadId: string): void {
    const key = this.#key(agentId, threadId);
    const previous = this.#threads.get(key);
    if (!previous) {
      this.#threads.set(key, { tierIndex: 0, lastChoice: null, escalateNext: true, taskGeneration: 0 });
      return;
    }
    this.#threads.set(key, { ...previous, escalateNext: true });
  }

  forgetAgent(agentId: string): void {
    for (const key of [...this.#threads.keys()]) {
      if (key.startsWith(`${agentId}\0`)) this.#threads.delete(key);
    }
  }
}

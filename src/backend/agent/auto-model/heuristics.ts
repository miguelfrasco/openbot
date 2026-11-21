import {
  AUTO_CLASSIFY_BORDERLINE_HIGH,
  AUTO_CLASSIFY_BORDERLINE_LOW,
  autoModelClassificationEnabled,
} from "./constants";

export interface TurnHeuristicInput {
  text: string;
  attachmentCount: number;
  priorTurnCount: number;
  contextChars: number;
}

export interface TurnHeuristicResult {
  complexity: number;
  reasons: string[];
}

const CODE_MARKERS =
  /\b(?:```|diff --git|stack trace|traceback|\.tsx?\b|\.jsx?\b|function\s+\w+\s*\(|class\s+\w+|import\s+.+\s+from)\b/iu;
const PLAN_MARKERS = /\b(?:architecture|migrate|refactor|design|roadmap|RFC|plan\b|step[- ]by[- ]step)\b/iu;
const TOOL_MARKERS = /\b(?:run tests?|e2e\b|CI\b|deploy|grep|npm |bun run|git (?:push|rebase|merge))\b/iu;

export function scoreTurnComplexity(input: TurnHeuristicInput): TurnHeuristicResult {
  const reasons: string[] = [];
  let complexity = 18;
  const chars = input.text.length + input.contextChars;
  if (chars < 280) {
    complexity -= 10;
    reasons.push("short_prompt");
  } else if (chars < 1_200) {
    complexity += 4;
    reasons.push("medium_prompt");
  } else if (chars < 6_000) {
    complexity += 14;
    reasons.push("long_prompt");
  } else {
    complexity += 28;
    reasons.push("very_long_prompt");
  }
  if (input.attachmentCount > 0) {
    complexity += 8 + Math.min(12, input.attachmentCount * 4);
    reasons.push("attachments");
  }
  if (CODE_MARKERS.test(input.text)) {
    complexity += 16;
    reasons.push("code_or_diff");
  }
  if (PLAN_MARKERS.test(input.text)) {
    complexity += 12;
    reasons.push("planning_language");
  }
  if (TOOL_MARKERS.test(input.text)) {
    complexity += 10;
    reasons.push("tool_heavy");
  }
  if (input.priorTurnCount > 6) {
    complexity += 6;
    reasons.push("multi_step_thread");
  }
  return { complexity: Math.max(0, Math.min(100, complexity)), reasons };
}

export function classificationTieBreak(complexity: number): number {
  if (!autoModelClassificationEnabled()) return complexity;
  if (complexity >= AUTO_CLASSIFY_BORDERLINE_LOW && complexity <= AUTO_CLASSIFY_BORDERLINE_HIGH) {
    return complexity + 8;
  }
  return complexity;
}

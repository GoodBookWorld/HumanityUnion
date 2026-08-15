import type {
  LifecycleSafetyCategoryHit,
  LifecycleSafetyEvaluationInput,
  LifecycleSafetyProviderResult,
} from "@hu/types";

/**
 * Safety Architecture Pack 01 Part 4 — provider-independent contract.
 * Gemini Safety and future providers implement this interface only.
 * Nothing in the Lifecycle UI or stage editors imports a concrete model SDK.
 */
export interface SafetyProvider {
  readonly providerId: string;
  evaluate(input: LifecycleSafetyEvaluationInput): Promise<LifecycleSafetyProviderResult>;
}

/**
 * Deterministic baseline checks that do not call any external AI.
 * Used until a real SafetyProvider (e.g. Gemini Safety) is wired.
 *
 * - Prompt-injection / instruction-override patterns → unsafe
 * - Obvious private credential leakage patterns → unsafe
 * - Everything else → uncertain (held as needs_review at policy layer
 *   only when configured; default mapping treats uncertain as accepted
 *   for this architecture pack so legitimate civic content is not blocked
 *   without a real classifier — see `mapProviderSignalToOutcome`)
 */
const PROMPT_INJECTION_PATTERNS: readonly { pattern: RegExp; detail: string }[] = [
  {
    pattern: /\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?\b/i,
    detail: "Instruction-override / ignore-previous-instructions pattern.",
  },
  {
    pattern: /\bdisregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?)\b/i,
    detail: "Instruction-override / disregard-rules pattern.",
  },
  {
    pattern: /\b(system\s+prompt|reveal\s+(your|the)\s+system)\b/i,
    detail: "System prompt extraction attempt.",
  },
  {
    pattern: /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\s+(DAN|jailbreak|unrestricted)\b/i,
    detail: "Role-manipulation / jailbreak pattern.",
  },
  {
    pattern: /\boverride\s+(your|the)\s+(safety|content)\s+(policy|filters?|rules?)\b/i,
    detail: "Safety-policy override attempt.",
  },
];

const CREDENTIAL_LEAKAGE_PATTERNS: readonly { pattern: RegExp; detail: string }[] = [
  {
    pattern: /\b(api[_-]?key|secret[_-]?key|private[_-]?key)\s*[:=]\s*\S+/i,
    detail: "Possible API/secret key material in plain text.",
  },
  {
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/i,
    detail: "Possible bearer token in plain text.",
  },
  {
    pattern: /\bpassword\s*[:=]\s*\S+/i,
    detail: "Possible password assignment in plain text.",
  },
];

function collectHits(
  text: string,
  patterns: readonly { pattern: RegExp; detail: string }[],
  categoryId: LifecycleSafetyCategoryHit["categoryId"],
): LifecycleSafetyCategoryHit[] {
  const hits: LifecycleSafetyCategoryHit[] = [];

  for (const entry of patterns) {
    if (entry.pattern.test(text)) {
      hits.push({
        categoryId,
        confidence: "high",
        detail: entry.detail,
      });
    }
  }

  return hits;
}

/**
 * Architecture-pack baseline provider. Not Gemini. Not a networked model.
 * Only flags high-confidence structural abuse patterns (injection / credentials).
 */
export class BaselineHeuristicSafetyProvider implements SafetyProvider {
  readonly providerId = "baseline-heuristic-v1";

  evaluate(input: LifecycleSafetyEvaluationInput): Promise<LifecycleSafetyProviderResult> {
    const text = input.text ?? "";
    const categories: LifecycleSafetyCategoryHit[] = [
      ...collectHits(text, PROMPT_INJECTION_PATTERNS, "prompt_injection"),
      ...collectHits(text, PROMPT_INJECTION_PATTERNS, "ai_manipulation"),
      ...collectHits(text, CREDENTIAL_LEAKAGE_PATTERNS, "private_credential_leakage"),
    ];

    // Deduplicate by categoryId+detail
    const unique = new Map<string, LifecycleSafetyCategoryHit>();
    for (const hit of categories) {
      unique.set(`${hit.categoryId}:${hit.detail}`, hit);
    }
    const deduped = [...unique.values()];

    if (deduped.length > 0) {
      return Promise.resolve({
        signal: "unsafe",
        categories: deduped,
        providerId: this.providerId,
        providerNotes: "Baseline heuristic rejection — no external AI consulted.",
      });
    }

    return Promise.resolve({
      signal: "safe",
      categories: [],
      providerId: this.providerId,
      providerNotes:
        "Baseline heuristic pass. Broader harm categories await a real SafetyProvider adapter.",
    });
  }
}

/**
 * Placeholder for a future Gemini Safety adapter. Always returns uncertain
 * and must never be selected as the default provider until credentials and
 * policy mapping are explicitly configured.
 */
export class UnavailableGeminiSafetyProvider implements SafetyProvider {
  readonly providerId = "gemini-safety-unavailable";

  evaluate(): Promise<LifecycleSafetyProviderResult> {
    return Promise.resolve({
      signal: "uncertain",
      categories: [],
      providerId: this.providerId,
      providerNotes: "Gemini Safety is not connected (Safety Architecture Pack 01).",
    });
  }
}

let activeProvider: SafetyProvider = new BaselineHeuristicSafetyProvider();

export function resolveSafetyProvider(): SafetyProvider {
  return activeProvider;
}

/** Test / future bootstrap seam — never call from UI. */
export function setSafetyProviderForTests(provider: SafetyProvider): void {
  activeProvider = provider;
}

export function resetSafetyProviderForTests(): void {
  activeProvider = new BaselineHeuristicSafetyProvider();
}

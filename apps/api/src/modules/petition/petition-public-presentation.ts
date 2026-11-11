import { presentLifecycleStageTokensAsEnglish, type PetitionSubject } from "@hu/types";

const OPTIONAL_TEXT_FIELDS = ["requestStatement", "expectedOutcome", "supportingContext"] as const;

function presentText<TValue>(value: TValue): TValue {
  return (
    typeof value === "string" ? presentLifecycleStageTokensAsEnglish(value) : value
  ) as TValue;
}

/**
 * HU-LC-05C.4C.6L — participant-facing Petition text never shows raw
 * `{lifecycleStage:...}` tokens. Stored Petition content keeps its tokens
 * (Content Translation relies on them); only public outputs are composed with
 * the English lifecycle registry labels, as the public Collaborative Analysis
 * projection does. Non-string and absent values pass through unchanged.
 */
export function presentPetitionSubjectForParticipants<TSubject extends PetitionSubject>(
  subject: TSubject,
): TSubject {
  const presented: TSubject = {
    ...subject,
    title: presentText(subject.title),
    summary: presentText(subject.summary),
  };

  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (typeof subject[field] === "string") {
      presented[field] = presentText(subject[field]);
    }
  }

  if (Array.isArray(subject.keyArguments)) {
    presented.keyArguments = subject.keyArguments.map(presentText);
  }

  return presented;
}

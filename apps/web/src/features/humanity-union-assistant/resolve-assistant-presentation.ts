import type { HumanityUnionAssistantSurfaceId } from "@hu/types";

/** Minimal next-intl translate shape used for Assistant presentation. */
export type AssistantPresentationTranslate = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string;

export interface ResolveAssistantPresentationInput {
  readonly surfaceId: HumanityUnionAssistantSurfaceId;
  readonly displayName: string;
  readonly siteName: string;
  readonly t: AssistantPresentationTranslate;
  /** Blog publication editor override (Pack 16D). */
  readonly publicationAuthoring?: boolean;
}

export interface AssistantPresentation {
  readonly featureLabel: string;
  readonly greeting: string;
  readonly suggestedQuestions: readonly string[];
}

function firstName(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function surfaceCatalogKey(
  surfaceId: HumanityUnionAssistantSurfaceId,
  publicationAuthoring: boolean,
): string {
  if (publicationAuthoring) {
    return "publicationAuthoring";
  }
  return surfaceId;
}

/**
 * Participant-facing Assistant chrome: feature label, greeting, suggested questions.
 * Brand `siteName` is the runtime identity authority via `{siteName}` ICU tokens.
 * API greeting / featureLabel / suggestedQuestions remain server/AI context only.
 */
export function resolveAssistantPresentation(
  input: ResolveAssistantPresentationInput,
): AssistantPresentation {
  const catalogKey = surfaceCatalogKey(
    input.surfaceId,
    Boolean(input.publicationAuthoring),
  );
  const base = `assistant.surfaces.${catalogKey}` as const;
  const featureLabel = input.t(`${base}.featureLabel`);
  const name = firstName(input.displayName);
  const values = {
    name,
    feature: featureLabel,
    siteName: input.siteName,
  };
  return {
    featureLabel,
    greeting: input.t(`${base}.greeting`, values),
    suggestedQuestions: [
      input.t(`${base}.q1`, values),
      input.t(`${base}.q2`, values),
      input.t(`${base}.q3`, values),
    ],
  };
}

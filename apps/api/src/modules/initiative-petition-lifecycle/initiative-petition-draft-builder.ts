import type { InitiativePetitionIntelligenceSnapshot } from "@hu/types";

/**
 * Initiative Lifecycle — Part F, Section 3 (Petition Draft Builder).
 *
 * Deterministic, provider-independent generation of the Petition's
 * structured content fields from the Intelligence Snapshot — mirrors the
 * `RevisionDraftProvider`/`resolveRevisionDraftProvider` seam from Part E
 * so a future AI provider can be substituted later without any caller
 * changing. "No AI publishing or automatic signatures" — this only
 * produces suggested TEXT for the Author's draft; nothing here ever calls
 * `publishPetition` or creates a `Signature`.
 */
export interface GeneratedPetitionDraftContent {
  readonly title: string;
  readonly publicSummary: string;
  readonly requestStatement: string;
  readonly expectedOutcome: string;
  readonly supportingContext: string;
  readonly keyArguments: readonly string[];
}

export interface PetitionDraftProvider {
  readonly providerId: string;
  generateDraftContent(
    snapshot: InitiativePetitionIntelligenceSnapshot,
  ): Promise<GeneratedPetitionDraftContent>;
}

function buildKeyArguments(snapshot: InitiativePetitionIntelligenceSnapshot): string[] {
  const args: string[] = [];

  if (snapshot.revisionReference) {
    args.push(
      `This request is based on the published Revision (v${snapshot.revisionReference.version}): ${snapshot.revisionReference.revisionSummary}`,
    );
  }

  if (snapshot.analysisReference) {
    args.push(`Collaborative Analysis: ${snapshot.analysisReference.summary}`);
  }

  for (const proposal of snapshot.proposalReferences) {
    args.push(`Improvement Proposal "${proposal.title}": ${proposal.summary}`);
  }

  return args.filter((entry) => entry.trim().length > 0);
}

function generateDeterministicPetitionDraftContent(
  snapshot: InitiativePetitionIntelligenceSnapshot,
): GeneratedPetitionDraftContent {
  const title = snapshot.initiativeTitle ? `Petition: ${snapshot.initiativeTitle}` : "Petition";

  const publicSummary = snapshot.revisionReference
    ? snapshot.revisionReference.revisionSummary
    : snapshot.initiativeDescription;

  const requestStatement = snapshot.initiativeTitle
    ? `We call on decision-makers to act on "${snapshot.initiativeTitle}" as described in the published Revision.`
    : "We call on decision-makers to act on this Initiative.";

  const expectedOutcome = snapshot.revisionReference
    ? `Adoption of the changes described in Revision v${snapshot.revisionReference.version} is expected to: ${snapshot.revisionReference.revisionSummary}`
    : "The expected outcome will be described once a Revision has been published.";

  const supportingContextParts = [
    snapshot.analysisReference ? `Collaborative Analysis: ${snapshot.analysisReference.summary}` : null,
    snapshot.proposalReferences.length > 0
      ? `Supported by ${snapshot.proposalReferences.length} Improvement Proposal(s) accepted into the Revision.`
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  return {
    title,
    publicSummary,
    requestStatement,
    expectedOutcome,
    supportingContext: supportingContextParts.join("\n\n"),
    keyArguments: buildKeyArguments(snapshot),
  };
}

export const deterministicPetitionDraftProvider: PetitionDraftProvider = {
  providerId: "deterministic-v1",
  generateDraftContent: (snapshot) =>
    Promise.resolve(generateDeterministicPetitionDraftContent(snapshot)),
};

export function resolvePetitionDraftProvider(): PetitionDraftProvider {
  return deterministicPetitionDraftProvider;
}

export async function generatePetitionDraftContent(
  snapshot: InitiativePetitionIntelligenceSnapshot,
): Promise<GeneratedPetitionDraftContent> {
  const provider = resolvePetitionDraftProvider();
  return provider.generateDraftContent(snapshot);
}

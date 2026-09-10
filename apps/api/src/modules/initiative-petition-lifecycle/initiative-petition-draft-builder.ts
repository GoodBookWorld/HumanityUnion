import {
  lifecycleStageToken,
  type InitiativePetitionIntelligenceSnapshot,
} from "@hu/types";

/**
 * Initiative Lifecycle — Part F, Section 3 (Petition Draft Builder).
 *
 * Deterministic, provider-independent generation of the Petition's
 * structured content fields from the Intelligence Snapshot.
 *
 * Localization repair — do not persist final English labels such as
 * `Revision v${n}` / `Revision (v${n})`. Version numbers stay numeric;
 * lifecycle stage names use `{lifecycleStage:<id>}` tokens for CT/CV.
 * Traceability chrome (`supportingRevision`) is WEB_UI with raw revisionId.
 */

const ANALYSIS_STAGE = lifecycleStageToken("analysis");
const PROPOSAL_STAGE = lifecycleStageToken("proposal");
const PETITION_STAGE = lifecycleStageToken("petition");

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
      `This request is based on published version ${snapshot.revisionReference.version}: ${snapshot.revisionReference.revisionSummary}`,
    );
  }

  if (snapshot.analysisReference) {
    args.push(`${ANALYSIS_STAGE}: ${snapshot.analysisReference.summary}`);
  }

  for (const proposal of snapshot.proposalReferences) {
    args.push(`${PROPOSAL_STAGE} "${proposal.title}": ${proposal.summary}`);
  }

  return args.filter((entry) => entry.trim().length > 0);
}

function generateDeterministicPetitionDraftContent(
  snapshot: InitiativePetitionIntelligenceSnapshot,
): GeneratedPetitionDraftContent {
  const title = snapshot.initiativeTitle
    ? `${PETITION_STAGE}: ${snapshot.initiativeTitle}`
    : PETITION_STAGE;

  const publicSummary = snapshot.revisionReference
    ? snapshot.revisionReference.revisionSummary
    : snapshot.initiativeDescription;

  const requestStatement = snapshot.initiativeTitle
    ? `We call on decision-makers to act on "${snapshot.initiativeTitle}" as described in the published version.`
    : "We call on decision-makers to act on this Initiative.";

  const expectedOutcome = snapshot.revisionReference
    ? `Adoption of the changes described in version ${snapshot.revisionReference.version} is expected to: ${snapshot.revisionReference.revisionSummary}`
    : "The expected outcome will be described once a published version is available.";

  const supportingContextParts = [
    snapshot.analysisReference
      ? `${ANALYSIS_STAGE}: ${snapshot.analysisReference.summary}`
      : null,
    snapshot.proposalReferences.length > 0
      ? `Supported by ${snapshot.proposalReferences.length} ${PROPOSAL_STAGE} item(s) accepted into the published version.`
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

/** Test/helper — true when draft prose still contains banned Revision vN templates. */
export function petitionDraftContainsBannedRevisionLabel(text: string): boolean {
  return /\bRevision\s*\(?\s*v\d+/i.test(text) || /\bRevision\s+v\d+/i.test(text);
}

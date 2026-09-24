/**
 * Canonical public-reader WEB_UI readiness scope.
 *
 * Ownership is unchanged: these keys, and the excluded author/steward keys,
 * all remain WEB_UI catalog data. This list only decides which keys are
 * required before a locale is public-presentation data-ready.
 *
 * Locale-independent. Add or remove a prefix only when the product gains or
 * loses an ordinary public-reader surface.
 *
 * Excluded on purpose (still valid catalog keys):
 * - `workspace.*` / `notifications.*` / `preferences.*` / `memberProfile.*` —
 *   ordinary Participant surfaces (Step 15D.2/15D.5 `isParticipantWebUiRequiredPath`;
 *   not public-reader blocking)
 * - `initiativeExperience.manage` — create/edit form (Participant readiness)
 * - `initiativeExperience.author.sidebar` — lifecycle working sidebar
 * - `initiativeExperience.author.actions` / `sources` / `translation` — author verbs
 * - other `initiativeExperience.author.*` editor trees that are not listed below
 *
 * Public result components still read named author subtrees (`*.public`,
 * field/section labels, ballot, archive document, shared result chrome).
 * Those prefixes stay required. The whole `author` tree is not.
 *
 * Step 15D.1 — ordinary public surfaces (stats metrics, PWA install, world
 * initiatives list, initiative mini-card chrome, Search page chrome, Support)
 * are required. Search result civic content remains CT/PLP-owned.
 *
 * Step 15D.5 — `participantPublic.*` is public member/profile chrome
 * (`/member/{publicName}`). Persisted bio/skills remain PLP-owned
 * (`participant_public`).
 */

export const PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES = [
  "common.",
  "navigation.",
  "actuc.",
  "membershipPublic.",
  "institutionsPublic.",
  "publicHome.",
  "publicStatistics.",
  "pwa.",
  "worldInitiativesPublic.",
  "publicInitiativeMiniCard.",
  "search.",
  "supportPublic.",
  "blogPublic.",
  "knowledgePublic.",
  "civicMediaPublic.",
  "volunteerPublic.",
  "contactPublic.",
  "legalPublic.",
  "participantPublic.",
  "initiativeExperience.activityAreas.",
  "initiativeExperience.assistant.",
  "initiativeExperience.civicArchivePublic.",
  "initiativeExperience.collaboration.",
  "initiativeExperience.common.",
  "initiativeExperience.documents.",
  "initiativeExperience.geography.",
  "initiativeExperience.hero.",
  "initiativeExperience.journey.",
  "initiativeExperience.lifecycle.",
  "initiativeExperience.lifecycleEmpty.",
  "initiativeExperience.lifecycleRecordFields.",
  "initiativeExperience.lifecycleRecordSummaries.",
  "initiativeExperience.lifecycleRecordTitles.",
  "initiativeExperience.overview.",
  "initiativeExperience.petitionSignature.",
  "initiativeExperience.phases.",
  "initiativeExperience.presentationStatuses.",
  "initiativeExperience.publicChoice.",
  "initiativeExperience.sidebar.",
  "initiativeExperience.stages.",
  "initiativeExperience.states.",
  "initiativeExperience.statuses.",
  "initiativeExperience.tabs.",
  "initiativeExperience.translation.",
  "initiativeExperience.author.shared.",
  "initiativeExperience.author.analysis.fields.",
  "initiativeExperience.author.analysis.preview.",
  "initiativeExperience.author.analysis.public.",
  "initiativeExperience.author.archive.document.",
  "initiativeExperience.author.archive.public.",
  "initiativeExperience.author.collectiveDecision.ballot.",
  "initiativeExperience.author.collectiveDecision.public.",
  "initiativeExperience.author.collectiveDecision.sections.",
  "initiativeExperience.author.commitment.messages.",
  "initiativeExperience.author.commitment.public.",
  "initiativeExperience.author.decisionSession.fields.",
  "initiativeExperience.author.decisionSession.public.",
  "initiativeExperience.author.decisionSession.sections.",
  "initiativeExperience.author.officialResponse.public.",
  "initiativeExperience.author.officialResponse.sections.",
  "initiativeExperience.author.petition.fields.",
  "initiativeExperience.author.petition.public.",
  "initiativeExperience.author.proposal.fields.",
  "initiativeExperience.author.proposal.preview.",
  "initiativeExperience.author.proposal.public.",
  "initiativeExperience.author.publicImpact.public.",
  "initiativeExperience.author.publicImpact.report.",
  "initiativeExperience.author.tracking.public.",
] as const;

export type PublicReaderWebUiRequiredPrefix =
  (typeof PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES)[number];

/** True when a catalog path is required for ordinary public-reader WEB_UI readiness. */
export function isPublicReaderWebUiRequiredPath(pathKey: string): boolean {
  return PUBLIC_READER_WEB_UI_REQUIRED_PREFIXES.some(
    (prefix) => pathKey === prefix.slice(0, -1) || pathKey.startsWith(prefix),
  );
}

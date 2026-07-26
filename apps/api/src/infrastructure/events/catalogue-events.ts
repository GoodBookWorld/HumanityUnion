/**
 * Canonical Catalogue event name constants (v1.0 subset).
 * Full registry: engineering/CANONICAL_EVENT_CATALOGUE.md
 *
 * Infrastructure-only — business modules import these when publishing.
 */

export const CATALOGUE_EVENTS = {
  memberRegistered: "MemberRegistered",
  memberAuthenticated: "MemberAuthenticated",
  sessionEnded: "SessionEnded",
  memberVerified: "MemberVerified",
  memberProfileUpdated: "MemberProfileUpdated",
  responsibilityProfileUpdated: "ResponsibilityProfileUpdated",
  workspaceInitialized: "WorkspaceInitialized",
  workspacePreferencesUpdated: "WorkspacePreferencesUpdated",
  activityCreated: "ActivityCreated",
  activityRevised: "ActivityRevised",
  activityClosed: "ActivityClosed",
  discussionCreated: "DiscussionCreated",
  discussionOpened: "DiscussionOpened",
  discussionClosed: "DiscussionClosed",
  contributionAdded: "ContributionAdded",
  evidenceContributed: "EvidenceContributed",
  proposalSubmitted: "ProposalSubmitted",
  proposalCreated: "ProposalCreated",
  proposalRevised: "ProposalRevised",
  proposalWithdrawn: "ProposalWithdrawn",
  decisionApproved: "DecisionApproved",
  decisionRejected: "DecisionRejected",
  decisionReturnedForRevision: "DecisionReturnedForRevision",
  decisionOpened: "DecisionOpened",
  implementationStarted: "ImplementationStarted",
  implementationSuspended: "ImplementationSuspended",
  implementationCompleted: "ImplementationCompleted",
  impactRecorded: "ImpactRecorded",
  notificationDelivered: "NotificationDelivered",
  notificationRead: "NotificationRead",
} as const;

export type CatalogueEventName = (typeof CATALOGUE_EVENTS)[keyof typeof CATALOGUE_EVENTS];

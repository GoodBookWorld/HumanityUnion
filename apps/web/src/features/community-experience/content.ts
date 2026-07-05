export function communityIdentityContextIntroduction(communityName: string): string {
  return `This page shows public civic activity associated with ${communityName} — a participant-created community on Humanity Union. Observation here is part of one connected regional, national and global civic space.`;
}

export function communityStatisticsContextIntroduction(communityName: string): string {
  return `These figures summarize public civic activity associated with ${communityName} on Humanity Union. Counts and indicators are computed from public records — derived values are labeled accordingly.`;
}

export function communityPipelineContextIntroduction(communityName: string): string {
  return `Participation on Humanity Union follows a structured civic path from proposal through collective action. This overview shows how many public initiatives are visible at each stage associated with ${communityName}.`;
}

export function communityInitiativesContextIntroduction(communityName: string): string {
  return `These are recent public initiatives associated with ${communityName} on Humanity Union. Active cards link to verifiable public records you may read without registering.`;
}

export function communityImpactContextIntroduction(communityName: string): string {
  return `The indicators below summarize observable public outcomes associated with ${communityName} — derived from public civic records already visible on Humanity Union. They describe what is publicly observable — not a judgment of community worth.`;
}

export const COMMUNITY_IMPACT_VISITOR_CONCLUSION =
  "You may form your own understanding of observable community impact from the evidence above. Humanity Union presents public records — it does not evaluate this community for you.";

export const FIND_YOUR_COMMUNITY_CONTENT = {
  title: "Find Your Community",
  contextIntroduction:
    "Communities on Humanity Union are created through civic participation — not assigned by administrators. Browse or search participant-created communities below.",
  browseLabel: "Participant-created communities available to observe",
  searchLabel: "Filter by community name or description",
  searchPlaceholder: "Search by community name or description",
  emptyResults:
    "No participant-created communities match your search. Try a different name or description.",
  currentCommunityNote:
    "You are already viewing one community. Browse or search below to discover others created through participation.",
} as const;

export function registrationGatewayContextIntroduction(communityName: string): string {
  return `You can explore public civic activity around ${communityName} without an account. Registration allows you to take part in structured participation when you are ready.`;
}

export function workspaceContinuationContextIntroduction(communityName: string): string {
  return `You can continue exploring public civic activity around ${communityName}, or enter your Workspace to participate personally in structured civic action when you choose.`;
}

export const REGISTRATION_GATEWAY_WORKSPACE_CONTENT = {
  title: "Join Humanity Union",
  invitation:
    "You can explore public civic activity without an account. Registration enables structured participation when you choose.",
  explorationNote:
    "Reading and exploring remain available without registration or entering Workspace.",
  registrationActionLabel: "Join Humanity Union",
  registrationPlaceholderLabel:
    "Registration entry coming soon — Identity Capability not yet available",
  workspaceActionLabel: "Continue to Workspace",
  workspacePlaceholderLabel: "Workspace entry coming soon",
  authenticatedNote:
    "You may continue reading this community page or enter Workspace when you choose personal accountable participation.",
} as const;

export const COMMUNITY_STATISTICS_PUBLIC_NOTE =
  "Public aggregate indicators only — no private participant identities and no operational database access.";

export const COMMUNITY_STATISTICS_VISITOR_CONCLUSION =
  "These aggregates describe observable public activity — not community worth or organizational performance.";

export const COMMUNITY_PIPELINE_VISITOR_CONCLUSION =
  "Stage distribution shows how structured participation appears around this community — the same civic path used at broader scopes.";

export const COMMUNITY_INITIATIVES_VISITOR_CONCLUSION =
  "Cards with an active public record link to verifiable civic detail. Demonstration cards without public records are labeled and not linked.";

export const FIND_YOUR_COMMUNITY_VISITOR_CONCLUSION =
  "Listed communities are participant-created observation pages — not an exhaustive administrator-maintained directory.";

export const REGISTRATION_VISITOR_CONCLUSION =
  "Registration and Workspace entry remain future capabilities. Public observation does not require an account.";

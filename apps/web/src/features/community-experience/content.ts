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
  return `These are recent public initiatives associated with ${communityName} on Humanity Union. Each links to a public record of its civic path — you can read details without registering.`;
}

export function communityImpactContextIntroduction(communityName: string): string {
  return `The indicators below summarize observable public outcomes associated with ${communityName} — derived from public civic records already visible on Humanity Union. They describe what is publicly observable — not a judgment of community worth.`;
}

export const COMMUNITY_IMPACT_VISITOR_CONCLUSION =
  "You may form your own understanding of observable community impact from the evidence above. Humanity Union presents public records — it does not evaluate this community for you.";

export const FIND_YOUR_COMMUNITY_CONTENT = {
  title: "Find Your Community",
  contextIntroduction:
    "Communities on Humanity Union are created through civic participation. Search below finds participant-created communities by name and description — not a fixed administrative catalog.",
  searchLabel: "Search participant-created communities",
  searchPlaceholder: "Search by community name or description",
  emptyResults:
    "No participant-created communities match your search. Try a different name or description.",
  currentCommunityNote: "You are already viewing one community. Search below to discover others.",
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
  registrationPlaceholderLabel: "Registration entry coming soon",
  workspaceActionLabel: "Continue to Workspace",
  workspacePlaceholderLabel: "Workspace entry coming soon",
  authenticatedNote:
    "You may continue reading this community page or enter Workspace when you choose personal accountable participation.",
} as const;

export const COMMUNITY_STATISTICS_VISITOR_CONCLUSION =
  "These aggregates describe observable public activity — not community worth or organizational performance.";

export const COMMUNITY_PIPELINE_VISITOR_CONCLUSION =
  "Stage distribution shows how structured participation appears around this community — the same civic path used at broader scopes.";

export const COMMUNITY_INITIATIVES_VISITOR_CONCLUSION =
  "Each initiative links to verifiable public detail you may read without registering.";

export const FIND_YOUR_COMMUNITY_VISITOR_CONCLUSION =
  "Search results show participant-created communities with public records — not an exhaustive administrator-maintained directory.";

export const REGISTRATION_VISITOR_CONCLUSION =
  "Participation and Workspace entry remain optional after you have observed sufficient public context.";

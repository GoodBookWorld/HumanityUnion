import type { LatestInitiativesPublicProjection } from "@hu/types";

function publicInitiativeHref(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

export const WORLD_LATEST_INITIATIVES_PUBLIC_PROJECTION: LatestInitiativesPublicProjection = {
  scope: "world",
  scopeLabel: "World",
  source: "bootstrap",
  generatedAt: "2026-01-01T00:00:00.000Z",
  initiatives: [
    {
      initiativeId: "initiative-bootstrap-001",
      title: "Community Garden Initiative",
      summary:
        "Establish a shared community garden to improve local food access and neighborhood cooperation.",
      geographicScope: "British Columbia, World",
      participationStage: "Implementation",
      publicStatus: "Draft",
      publicRouteStatus: "active",
      publicInitiativeHref: publicInitiativeHref("initiative-bootstrap-001"),
      recencyOrder: 1,
      relatedPublicLinks: [
        {
          label: "Public Collaborative Analysis",
          href: "/collaborative-analysis/public/analysis-bootstrap-001",
          routeStatus: "active",
        },
        {
          label: "Public Collective Decision",
          href: "/collective-decisions/public/decision-bootstrap-001",
          routeStatus: "active",
        },
        {
          label: "Public Petition",
          href: "/petitions/public/petition-bootstrap-001",
          routeStatus: "active",
        },
        {
          label: "Public Implementation",
          href: "/implementations/public/implementation-bootstrap-001",
          routeStatus: "active",
        },
      ],
    },
    {
      initiativeId: "initiative-bootstrap-demo-002",
      title: "Clean Water Access Proposal",
      summary:
        "Public proposal to improve shared water infrastructure and transparent community oversight.",
      geographicScope: "East Africa, World",
      participationStage: "Petition",
      publicStatus: "Proposal",
      publicRouteStatus: "unavailable",
      publicUnavailableNotice:
        "Demonstration card only — no public initiative record exists yet for this example.",
      recencyOrder: 2,
      relatedPublicLinks: [],
    },
    {
      initiativeId: "initiative-bootstrap-demo-003",
      title: "Neighborhood Safety Forum",
      summary:
        "Community-led forum to review public safety concerns through structured collective decision.",
      geographicScope: "Western Europe, World",
      participationStage: "Collective Decision",
      publicStatus: "Discussion",
      publicRouteStatus: "unavailable",
      publicUnavailableNotice:
        "Demonstration card only — no public initiative record exists yet for this example.",
      recencyOrder: 3,
      relatedPublicLinks: [],
    },
  ],
};

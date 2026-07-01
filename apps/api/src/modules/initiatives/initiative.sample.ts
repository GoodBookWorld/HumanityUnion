import type { Initiative } from "@hu/types";

export const sampleInitiative: Initiative = {
  initiativeId: "initiative-bootstrap-001",
  stewardId: "member-bootstrap-001",
  createdAt: "2026-06-27T00:00:00.000Z",
  updatedAt: "2026-06-27T00:00:00.000Z",
  title: "Community Garden Initiative",
  description: "Establish a shared community garden to improve local food access and neighborhood cooperation.",
  status: "draft",
  visibility: {
    policy: "steward_only",
  },
  metadata: {
    category: "Community",
    tags: ["Environment", "Food Security"],
    region: "British Columbia",
    language: "en",
  },
  revisions: [
    {
      revisionId: "revision-bootstrap-001",
      authorId: "member-bootstrap-001",
      revisionNumber: 1,
      summary: "Initial draft created.",
      createdAt: "2026-06-27T00:00:00.000Z",
    },
  ],
  contributions: [
    {
      contributionId: "contribution-bootstrap-001",
      memberId: "member-bootstrap-001",
      contributionType: "created",
      timestamp: "2026-06-27T00:00:00.000Z",
    },
  ],
  timeline: [
    {
      eventId: "timeline-bootstrap-001",
      eventType: "initiative_created",
      timestamp: "2026-06-27T00:00:00.000Z",
      metadata: {
        status: "draft",
      },
    },
  ],
};

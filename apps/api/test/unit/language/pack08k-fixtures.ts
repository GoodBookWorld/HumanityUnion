/**
 * Pack 08K — proof fixtures for PublicLocalizedPresentation.
 *
 * Uses @hu/types protected* helpers. Plain strings are AUTO_TRANSLATABLE.
 */

import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  protectedIdentity,
  protectedTechnical,
  type PublicPresentationIdentity,
  type PublicPresentationNode,
} from "@hu/types";

function identity(sourceKind: string, sourceRecordId: string): PublicPresentationIdentity {
  return {
    sourceKind,
    sourceRecordId,
    presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  };
}

export interface Pack08kPresentationFixture {
  readonly identity: PublicPresentationIdentity;
  readonly presentation: PublicPresentationNode;
}

/**
 * Five Blog presentations with distinct shapes.
 * sourceKind blog_post; unique sourceRecordId each.
 */
export function buildPack08kBlogFixture(): readonly Pack08kPresentationFixture[] {
  return [
    {
      identity: identity("blog_post", "pack08k-blog-short-01"),
      presentation: {
        title: "Short post: civic participation basics",
        excerpt: "A brief introduction to public participation.",
        body: "This short post explains why public voice matters in civic life.",
      },
    },
    {
      identity: identity("blog_post", "pack08k-blog-paragraphs-02"),
      presentation: {
        title: "Multiple paragraphs on shared stewardship",
        excerpt: "Longer body as paragraph array.",
        body: [
          "First paragraph describes community stewardship.",
          "Second paragraph covers transparent deliberation.",
          "Third paragraph invites continued public review.",
        ],
      },
    },
    {
      identity: identity("blog_post", "pack08k-blog-nested-03"),
      presentation: {
        title: "Nested rich content for lifecycle literacy",
        excerpt: "Sections with headings and paragraphs.",
        sections: [
          {
            heading: "Why nested sections matter",
            paragraphs: [
              "Nested headings must localize with their paragraphs.",
              "No field allowlist enrollment is required for new keys.",
            ],
          },
          {
            heading: "How participants read structure",
            paragraphs: ["Structure is semantic prose, not chrome."],
          },
        ],
      },
    },
    {
      identity: identity("blog_post", "pack08k-blog-author-04"),
      presentation: {
        title: "Post with protected author identity",
        excerpt: "Author name must remain byte-identical.",
        body: "Semantic body localizes; author identity does not.",
        authorName: protectedIdentity("Ada Civic-Steward"),
      },
    },
    {
      identity: identity("blog_post", "pack08k-blog-url-05"),
      presentation: {
        title: "Post containing a protected URL",
        excerpt: "Technical URL stays protected.",
        body: "Visit the linked resource for the original publication context.",
        url: protectedTechnical("https://example.org/pack08k/civic-source"),
      },
    },
  ];
}

/**
 * One realistic Initiative lifecycle presentation tree.
 * Petition MUST contain exactly 5 participant-facing paragraphs.
 */
export function buildPack08kLifecycleFixture(): Pack08kPresentationFixture {
  return {
    identity: identity("initiative_lifecycle", "pack08k-lifecycle-initiative-01"),
    presentation: {
      initiative: {
        title: "Pack 08K Lifecycle Initiative",
        description: "Canonical English description for the full lifecycle proof.",
        initiativeId: protectedTechnical("initiative-pack08k-lifecycle-01"),
      },
      discussion: {
        comments: [
          {
            body: "First discussion comment on priorities.",
            authorName: protectedIdentity("Commenter One"),
          },
          {
            body: "Second discussion comment proposing evidence.",
            authorName: protectedIdentity("Commenter Two"),
          },
          {
            body: "Third discussion comment summarizing trade-offs.",
            authorName: protectedIdentity("Commenter Three"),
          },
        ],
      },
      collaborativeAnalysis: {
        title: "Collaborative analysis of public options",
        sections: [
          {
            heading: "Evidence summary",
            paragraphs: [
              "Evidence paragraph one for the analysis.",
              "Evidence paragraph two for the analysis.",
            ],
          },
          {
            heading: "Options compared",
            paragraphs: ["Comparison paragraph describing options A and B."],
          },
        ],
      },
      improvementProposal: {
        title: "Structured improvement proposal",
        currentIssue: "The draft understates community constraints.",
        proposedChange: "Add a constraints section with measurable criteria.",
        rationale: "Participants need explicit constraints to deliberate fairly.",
        expectedImprovement: "Clearer proposals and fewer ambiguous revisions.",
        references: "See discussion comments and analysis evidence sections.",
      },
      revision: {
        revisionSummary: "Revision incorporates accepted proposal constraints.",
        title: "Revised initiative text after proposal acceptance",
      },
      petition: {
        title: "Petition for transparent public decision criteria",
        paragraphs: [
          "Petition paragraph one states the public ask.",
          "Petition paragraph two explains community impact.",
          "Petition paragraph three lists supporting evidence.",
          "Petition paragraph four requests a recorded decision session.",
          "Petition paragraph five commits to follow-through tracking.",
        ],
      },
      decisionSession: {
        title: "Decision session for petition criteria",
        summary: "Session will weigh petition paragraphs against analysis options.",
      },
      collectiveDecision: {
        title: "Collective decision on petition criteria",
        summary: "Decision records the adopted criteria for commitment.",
      },
      commitment: {
        title: "Commitment to implement adopted criteria",
        summary: "Commitment binds owners to measurable follow-through.",
      },
      tracking: {
        title: "Tracking progress against commitment",
        summary: "Tracking reports public milestones and remaining gaps.",
      },
      officialResponse: {
        title: "Official response acknowledging the decision",
        summary: "Official response confirms receipt and next public steps.",
      },
      publicImpact: {
        title: "Public impact after commitment execution",
        summary: "Impact summary describes observed civic outcomes.",
      },
      civicArchive: {
        title: "Civic archive record of the lifecycle",
        summary: "Archive preserves the public record for future participants.",
      },
    },
  };
}

/**
 * Media principles + trusted cards.
 * Outlet names = protectedIdentity; websiteUrl = protectedTechnical;
 * explanation/title/body = AUTO.
 */
export function buildPack08kMediaFixture(): Pack08kPresentationFixture {
  return {
    identity: identity("civic_media", "pack08k-media-01"),
    presentation: {
      principles: [
        {
          title: "Independence of trusted media evidence",
          body: "Principle body explaining independence requirements.",
        },
        {
          title: "Transparent sourcing for participants",
          body: "Principle body explaining transparent sourcing.",
        },
      ],
      trustedCards: [
        {
          outletName: protectedIdentity("National Civic Observer"),
          websiteUrl: protectedTechnical("https://example.org/national-civic-observer"),
          title: "Trusted card: national observer brief",
          explanation: "Explanation of why this outlet is trusted for country evidence.",
          body: "Editorial body summarizing the trusted evidence card.",
        },
        {
          outletName: protectedIdentity("Regional Public Record"),
          websiteUrl: protectedTechnical("https://example.org/regional-public-record"),
          title: "Trusted card: regional public record",
          explanation: "Explanation of regional record reliability.",
          body: "Editorial body for the regional trusted card.",
        },
      ],
    },
  };
}

/**
 * Exact required regression shape — new semantic keys without allowlist.
 */
export function buildPack08kFutureArtifactFixture(): Pack08kPresentationFixture {
  return {
    identity: identity("future_public_artifact", "pack08k-future-artifact-x"),
    presentation: {
      id: protectedTechnical("x"),
      creatorName: protectedIdentity("Alice"),
      title: "Canonical title",
      completelyNewSemanticProperty: "Canonical new prose",
      nested: {
        anotherNeverSeenBeforeField: "Canonical nested prose",
      },
    },
  };
}

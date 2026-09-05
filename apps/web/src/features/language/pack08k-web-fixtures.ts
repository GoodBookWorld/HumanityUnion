/**
 * Pack 08K — web-accessible presentation fixtures for browser acceptance.
 *
 * Mirrors apps/api/test/unit/language/pack08k-fixtures.ts shapes plus
 * knowledge / search / CI rail / discussion comment trees via adapters.
 */

import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  protectedIdentity,
  protectedTechnical,
  type PublicPresentationIdentity,
  type PublicPresentationNode,
} from "@hu/types";

import {
  asPublicPresentationNode as asCiNode,
  buildCiRailPresentation,
} from "./adapters/ci-rail-presentation";
import {
  asPublicPresentationNode as asKnowledgeNode,
  buildKnowledgeArticlePresentation,
} from "./adapters/knowledge-article-presentation";
import {
  asPublicPresentationNode as asSearchNode,
  buildSearchResultPresentation,
} from "./adapters/search-result-presentation";
import { collectAutoTranslatableNodes } from "./public-localized-presentation";

function identity(sourceKind: string, sourceRecordId: string): PublicPresentationIdentity {
  return {
    sourceKind,
    sourceRecordId,
    presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  };
}

export interface Pack08kWebFixture {
  readonly identity: PublicPresentationIdentity;
  readonly presentation: PublicPresentationNode;
}

export function buildPack08kBlogFixtures(): readonly Pack08kWebFixture[] {
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

export function buildPack08kLifecycleFixture(): Pack08kWebFixture {
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
        ],
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
    },
  };
}

export function buildPack08kMediaFixture(): Pack08kWebFixture {
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
      ],
    },
  };
}

export function buildPack08kKnowledgeSearchCiDiscussionFixtures(): readonly Pack08kWebFixture[] {
  return [
    {
      identity: identity("knowledge_article", "pack08k-knowledge-01"),
      presentation: asKnowledgeNode(
        buildKnowledgeArticlePresentation({
          articleId: "knowledge-pack08k-01",
          slug: "pack08k-knowledge",
          title: "Knowledge article on public localization",
          purpose: "Explain PublicLocalizedPresentation to participants.",
          overview: "Overview of the public localization boundary.",
          keyConcepts: ["AUTO_TRANSLATABLE default", "Explicit protection"],
          explanation: [
            {
              id: "sec-1",
              heading: "Boundary steps",
              body: "Sanitize, localize, then render only from presentation.",
            },
          ],
        }),
      ),
    },
    {
      identity: identity("search_result", "pack08k-search-01"),
      presentation: asSearchNode(
        buildSearchResultPresentation({
          entityId: "search-entity-pack08k-01",
          title: "Search result title for civic initiative",
          summary: "Search result summary describing the matched public record.",
        }),
      ),
    },
    {
      identity: identity("ci_rail", "pack08k-ci-rail-01"),
      presentation: asCiNode(
        buildCiRailPresentation({
          recordId: "ci-rail-pack08k-01",
          title: "CI rail collaboration opportunity title",
          summary: "CI rail summary of overlap and collaboration context.",
        }),
      ),
    },
    {
      identity: identity("discussion_comment", "pack08k-discussion-01"),
      presentation: {
        body: "One discussion comment body for browser acceptance.",
        authorName: protectedIdentity("Discussion Author"),
      },
    },
  ];
}

/** Build a full path→translated map for every AUTO node (locale-tagged proof text). */
export function buildFullLocaleTranslations(
  tree: PublicPresentationNode,
  localeTag: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of collectAutoTranslatableNodes(tree)) {
    out[node.path] = `[${localeTag}] ${node.value}`;
  }
  return out;
}

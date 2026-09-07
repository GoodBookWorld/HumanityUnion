import type {
  CivicMediaOverview,
  CivicMediaSelectionPrinciple,
  CivicMediaFaqItem,
} from "@hu/types";

export const CIVIC_MEDIA_OVERVIEW: CivicMediaOverview = {
  title: "Why trustworthy information matters",
  summary:
    "Democratic participation depends on shared facts. The Civic Media Center helps you find reliable sources, verify claims, and turn verified information into constructive civic action.",
  points: [
    {
      id: "trust",
      heading: "Trustworthy information protects democracy",
      body: "When communities share verified facts, deliberation stays focused on solutions instead of confusion.",
    },
    {
      id: "misinformation",
      heading: "Misinformation harms civic life",
      body: "False or manipulated information divides communities, erodes trust, and blocks collective problem-solving.",
    },
    {
      id: "responsibility",
      heading: "Verification is civic responsibility",
      body: "Responsible citizens check sources, compare evidence, and prefer correction over outrage before acting.",
    },
  ],
};

export const CIVIC_MEDIA_SELECTION_PRINCIPLES: readonly CivicMediaSelectionPrinciple[] = [
  {
    id: "editorial-transparency",
    title: "Editorial transparency",
    description:
      "Sources publish editorial standards, ownership structure, and funding information.",
    whyItMatters: "Readers can evaluate possible bias before trusting a report.",
    sortOrder: 1,
  },
  {
    id: "correction-policy",
    title: "Correction policy",
    description:
      "Sources document how errors are corrected and how readers can report inaccuracies.",
    whyItMatters: "Mistakes can be identified and corrected with public accountability.",
    sortOrder: 2,
  },
  {
    id: "professional-standards",
    title: "Professional standards",
    description: "Sources follow recognized journalistic or academic review practices.",
    whyItMatters: "Reporting follows recognized journalistic or academic review practices.",
    sortOrder: 3,
  },
  {
    id: "evidence-based",
    title: "Evidence-based reporting",
    description: "Claims are supported by verifiable documentation, data, or primary sources.",
    whyItMatters: "Claims can be traced to verifiable documentation or primary sources.",
    sortOrder: 4,
  },
  {
    id: "international-recognition",
    title: "International recognition",
    description: "Organizations are known for consistent standards across regions and languages.",
    whyItMatters: "Standards remain consistent across regions and languages.",
    sortOrder: 5,
  },
  {
    id: "fact-checking-practice",
    title: "Fact-checking practice",
    description: "Sources participate in or support independent verification workflows.",
    whyItMatters: "Verification workflows support independent claim review.",
    sortOrder: 6,
  },
] as const;

/**
 * RESET 05C / 05D — organization identity uses structural `{siteName}` tokens.
 * Brand Localization resolves display names at compose/render (English Brand
 * fallback remains "Humanity Union"). FAQ machine prose is PLP-owned and must
 * be rebuilt via automatic editorial enqueue (RESET 05D bootstrap) — Brand
 * substitution alone never counts as FAQ localization.
 */
export const CIVIC_MEDIA_FAQ: readonly CivicMediaFaqItem[] = [
  {
    id: "why-not-every-media",
    question: "Why isn't every media outlet listed?",
    answer:
      "{siteName} curates sources that meet published selection principles. Listing every outlet would imply endorsement through volume rather than standards.",
    sortOrder: 1,
  },
  {
    id: "how-selected",
    question: "How are resources selected?",
    answer:
      "Resources are reviewed for editorial transparency, correction policies, professional standards, and evidence-based practice. There are no popularity scores or rankings.",
    sortOrder: 2,
  },
  {
    id: "recommend-new",
    question: "Can {siteName} recommend new sources?",
    answer:
      "Participants may suggest sources through civic initiatives or support channels. Suggestions are evaluated against selection principles, not vote counts.",
    sortOrder: 3,
  },
  {
    id: "verify-every-article",
    question: "Does {siteName} verify every article?",
    answer:
      "No. {siteName} recommends organizations with strong standards. Readers should still verify individual claims using fact-checking resources.",
    sortOrder: 4,
  },
  {
    id: "initiative-from-news",
    question: "Can I create an initiative from any news item?",
    answer:
      "Yes. After verifying a story, use Create Initiative to propose constructive civic action. Outrage is not a civic workflow — verification and deliberation are.",
    sortOrder: 5,
  },
] as const;

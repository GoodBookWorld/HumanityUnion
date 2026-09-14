/**
 * Reset 03E — Media /media semantic ownership inventory (DECLARATIVE ONLY).
 *
 * Reset 03E.1: this table is NOT coverage authority. UNOWNED_FIELDS=0 here was a
 * false positive — it never inspected rendered DOM, PLP resolve RESULT, or nested
 * components. Use media-rendered-coverage.ts + MediaSemanticNode render contracts.
 */

export type MediaSemanticOwner =
  | "UI_DICTIONARY"
  | "PLP_ENTITY"
  | "BRAND"
  | "TERMINOLOGY"
  | "GEOGRAPHY"
  | "PROTECTED_CANONICAL"
  | "BUG_UNOWNED";

export type MediaSemanticField = {
  readonly id: string;
  readonly section:
    | "overview"
    | "initiative-flow"
    | "news"
    | "selection-principles"
    | "trusted-media"
    | "fact-checking"
    | "propaganda-analysis"
    | "faq"
    | "knowledge"
    | "controls"
    | "states"
    | "metadata";
  readonly label: string;
  readonly owner: MediaSemanticOwner;
  /** Component path relative to apps/web/src */
  readonly component: string;
  readonly notes?: string;
};

/**
 * Complete inventory for shared CivicMediaCenterPageContent (/media).
 * Ownership decisions (Reset 01 — visible content boundary):
 * - Overview + FAQ bodies → PLP civic_media_editorial (sole public owner)
 * - Initiative-flow stage UX → UI_DICTIONARY (pipeline.* chrome)
 * - Fact-check / propaganda bodies → PLP civic_media_fact_check / civic_media_propaganda
 * - Trusted explanation / principle title+description+why → PLP
 * - Outlet names / URLs → PROTECTED_CANONICAL
 * - Country labels with codes → GEOGRAPHY
 * - News card title/summary → PLP public_news (MACHINE; coherent card or canonical)
 * - Legacy civic_media CT is non-authoritative on the public path when PLP is enabled
 * - Rail/chrome a11y → UI_DICTIONARY
 */
export const MEDIA_SEMANTIC_INVENTORY: readonly MediaSemanticField[] = [
  // Overview
  { id: "overview.eyebrow", section: "overview", label: "Eyebrow", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "overview.pageTitle", section: "overview", label: "Page title", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "overview.title", section: "overview", label: "Overview title", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx", notes: "civic_media_editorial.overviewTitle" },
  { id: "overview.summary", section: "overview", label: "Overview summary", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx", notes: "civic_media_editorial.overviewSummary" },
  { id: "overview.points", section: "overview", label: "Overview points", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx", notes: "civic_media_editorial.overviewPoints" },
  { id: "metadata.title", section: "metadata", label: "Document title", owner: "UI_DICTIONARY", component: "app/media/page.tsx" },
  { id: "metadata.description", section: "metadata", label: "Document description", owner: "UI_DICTIONARY", component: "app/media/page.tsx" },
  { id: "metadata.brand.siteName", section: "metadata", label: "Document title brand", owner: "BRAND", component: "app/media/page.tsx", notes: "civicMediaPublic.metaTitle {siteName} via resolveBrandForMetadata" },

  // Initiative flow
  { id: "pipeline.chrome", section: "initiative-flow", label: "Pipeline eyebrow/title/description", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicPipelineWorkflow.tsx" },
  { id: "pipeline.stages", section: "initiative-flow", label: "Pipeline stage titles/descriptions", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicPipelineWorkflow.tsx" },
  { id: "pipeline.stageOf", section: "initiative-flow", label: "Stage N of M", owner: "UI_DICTIONARY", component: "features/horizontal-experience/HuxWorkflowStage.tsx" },

  // News
  { id: "news.chrome", section: "news", label: "News section chrome", owner: "UI_DICTIONARY", component: "features/public-news/components/PublicNewsSection.tsx" },
  { id: "news.toolbar", section: "news", label: "News toolbar labels", owner: "UI_DICTIONARY", component: "features/public-news/components/PublicNewsToolbar.tsx" },
  { id: "news.card.title", section: "news", label: "News card title", owner: "PLP_ENTITY", component: "features/public-news/components/PublicNewsCard.tsx", notes: "public_news.title MACHINE via carousel PLP" },
  { id: "news.card.summary", section: "news", label: "News card summary", owner: "PLP_ENTITY", component: "features/public-news/components/PublicNewsCard.tsx", notes: "public_news.summary MACHINE via carousel PLP" },
  { id: "news.card.category", section: "news", label: "News card category", owner: "UI_DICTIONARY", component: "features/public-news/components/PublicNewsCard.tsx", notes: "MediaRegistryCategory controlled vocab via publicNews.categories.*" },
  { id: "news.card.sourceName", section: "news", label: "News source name", owner: "PROTECTED_CANONICAL", component: "features/public-news/components/PublicNewsCard.tsx" },
  { id: "news.card.ctas", section: "news", label: "News card CTAs", owner: "UI_DICTIONARY", component: "features/public-news/components/PublicNewsCard.tsx" },

  // Principles
  { id: "principles.chrome", section: "selection-principles", label: "Principles section chrome", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "principles.title", section: "selection-principles", label: "Principle title", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "principles.description", section: "selection-principles", label: "Principle description", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "principles.whyItMatters", section: "selection-principles", label: "Why it matters", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },

  // Trusted
  { id: "trusted.chrome", section: "trusted-media", label: "Trusted section chrome", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "trusted.tabs", section: "trusted-media", label: "Category tabs", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/TrustedMediaCategoryTabs.tsx" },
  { id: "trusted.name", section: "trusted-media", label: "Outlet name", owner: "PROTECTED_CANONICAL", component: "features/civic-media-center/components/TrustedMediaRailCard.tsx" },
  { id: "trusted.explanation", section: "trusted-media", label: "Trusted explanation", owner: "PLP_ENTITY", component: "features/civic-media-center/components/TrustedMediaRailCard.tsx" },
  { id: "trusted.country", section: "trusted-media", label: "Coverage country", owner: "GEOGRAPHY", component: "features/civic-media-center/components/TrustedMediaRailCard.tsx" },
  { id: "trusted.websiteUrl", section: "trusted-media", label: "Website URL", owner: "PROTECTED_CANONICAL", component: "features/civic-media-center/components/TrustedMediaRailCard.tsx" },
  { id: "trusted.officialWebsite", section: "trusted-media", label: "Official website CTA", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/TrustedMediaRailCard.tsx" },

  // Fact checking — bodies are PLP (civic_media_fact_check); chrome stays UI_DICTIONARY
  { id: "fact.chrome", section: "fact-checking", label: "Fact-checking chrome", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "fact.name", section: "fact-checking", label: "Fact-check outlet name", owner: "PROTECTED_CANONICAL", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "fact.mission", section: "fact-checking", label: "Mission body", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "fact.coverage", section: "fact-checking", label: "Coverage chips", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },

  // Propaganda — bodies are PLP (civic_media_propaganda)
  { id: "propaganda.chrome", section: "propaganda-analysis", label: "Propaganda chrome", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "propaganda.name", section: "propaganda-analysis", label: "Propaganda outlet name", owner: "PROTECTED_CANONICAL", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "propaganda.focus", section: "propaganda-analysis", label: "Focus badge", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "propaganda.explanation", section: "propaganda-analysis", label: "Explanation", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },

  // FAQ / knowledge / states / controls
  { id: "faq.heading", section: "faq", label: "FAQ heading", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "faq.items", section: "faq", label: "FAQ Q/A prose", owner: "PLP_ENTITY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx", notes: "civic_media_editorial.faq surrounding prose; {siteName} tokens compose via Brand" },
  { id: "faq.brand.siteName", section: "faq", label: "FAQ organization identity", owner: "BRAND", component: "features/civic-media-center/components/BrandTokenizedSemanticText.tsx", notes: "RESET 05C — Brand Localization siteName spans inside FAQ Q/A" },
  { id: "knowledge.link", section: "knowledge", label: "Knowledge link", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "states.loading", section: "states", label: "Loading", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "states.unavailable", section: "states", label: "Unavailable", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/CivicMediaCenterPageContent.tsx" },
  { id: "controls.railNav", section: "controls", label: "Rail previous/next", owner: "UI_DICTIONARY", component: "features/civic-media-center/media-rail/MediaRailControls.tsx" },
  { id: "controls.railSummary", section: "controls", label: "Showing X–Y of Z", owner: "UI_DICTIONARY", component: "features/civic-media-center/media-rail/MediaRailViewport.tsx" },
  { id: "controls.logoAlt", section: "controls", label: "Media logo alt", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/MediaLogo.tsx" },
  { id: "controls.trustedTablist", section: "controls", label: "Trusted categories tablist", owner: "UI_DICTIONARY", component: "features/civic-media-center/components/TrustedMediaCategoryTabs.tsx" },
] as const;

export type MediaSemanticCoverageReport = {
  readonly MEDIA_SEMANTIC_FIELDS_TOTAL: number;
  readonly UI_DICTIONARY_FIELDS: number;
  readonly PLP_FIELDS: number;
  readonly BRAND_FIELDS: number;
  readonly TERMINOLOGY_FIELDS: number;
  readonly GEOGRAPHY_FIELDS: number;
  readonly PROTECTED_FIELDS: number;
  readonly UNOWNED_FIELDS: number;
  readonly unownedIds: readonly string[];
};

export function summarizeMediaSemanticCoverage(
  inventory: readonly MediaSemanticField[] = MEDIA_SEMANTIC_INVENTORY,
): MediaSemanticCoverageReport {
  const count = (owner: MediaSemanticOwner) =>
    inventory.filter((field) => field.owner === owner).length;
  const unowned = inventory.filter((field) => field.owner === "BUG_UNOWNED");
  return {
    MEDIA_SEMANTIC_FIELDS_TOTAL: inventory.length,
    UI_DICTIONARY_FIELDS: count("UI_DICTIONARY"),
    PLP_FIELDS: count("PLP_ENTITY"),
    BRAND_FIELDS: count("BRAND"),
    TERMINOLOGY_FIELDS: count("TERMINOLOGY"),
    GEOGRAPHY_FIELDS: count("GEOGRAPHY"),
    PROTECTED_FIELDS: count("PROTECTED_CANONICAL"),
    UNOWNED_FIELDS: unowned.length,
    unownedIds: unowned.map((field) => field.id),
  };
}

export function formatMediaSemanticCoverageReport(
  report: MediaSemanticCoverageReport = summarizeMediaSemanticCoverage(),
): string {
  return [
    `MEDIA_SEMANTIC_FIELDS_TOTAL=${report.MEDIA_SEMANTIC_FIELDS_TOTAL}`,
    `UI_DICTIONARY_FIELDS=${report.UI_DICTIONARY_FIELDS}`,
    `PLP_FIELDS=${report.PLP_FIELDS}`,
    `BRAND_FIELDS=${report.BRAND_FIELDS}`,
    `TERMINOLOGY_FIELDS=${report.TERMINOLOGY_FIELDS}`,
    `GEOGRAPHY_FIELDS=${report.GEOGRAPHY_FIELDS}`,
    `PROTECTED_FIELDS=${report.PROTECTED_FIELDS}`,
    `UNOWNED_FIELDS=${report.UNOWNED_FIELDS}`,
  ].join("\n");
}

export function assertMediaSemanticCoverageComplete(
  inventory: readonly MediaSemanticField[] = MEDIA_SEMANTIC_INVENTORY,
): MediaSemanticCoverageReport {
  const report = summarizeMediaSemanticCoverage(inventory);
  if (report.UNOWNED_FIELDS !== 0) {
    throw new Error(
      `Media semantic coverage failed: UNOWNED_FIELDS=${report.UNOWNED_FIELDS} (${report.unownedIds.join(", ")})`,
    );
  }
  return report;
}

import type { CivicMediaNewsWidget } from "@hu/types";

/** Curated reference widgets — not a live feed or aggregation engine. */
export const CIVIC_MEDIA_NEWS_WIDGETS: readonly CivicMediaNewsWidget[] = [
  {
    id: "widget-reuters-climate-report",
    source: "Reuters",
    headline: "Communities review adaptation plans after record heat season",
    publishedAt: "2026-06-18",
    excerpt:
      "Local governments are publishing updated resilience plans as residents request transparent timelines for infrastructure improvements.",
    originalUrl: "https://www.reuters.com/",
    sortOrder: 1,
  },
  {
    id: "widget-ap-water-infrastructure",
    source: "Associated Press",
    headline: "Regional agencies publish open data on water infrastructure audits",
    publishedAt: "2026-06-12",
    excerpt:
      "Audit summaries describe maintenance backlogs and invite public review sessions before budget decisions.",
    originalUrl: "https://apnews.com/",
    sortOrder: 2,
  },
  {
    id: "widget-bbc-civic-participation",
    source: "BBC",
    headline: "Citizen panels explore participatory budgeting pilots",
    publishedAt: "2026-06-05",
    excerpt:
      "Pilot programs document how residents prioritize public spending through structured deliberation rather than informal polls.",
    originalUrl: "https://www.bbc.com/",
    sortOrder: 3,
  },
] as const;

export function buildCreateInitiativeHref(widget: CivicMediaNewsWidget): string {
  const params = new URLSearchParams();
  params.set("mediaHeadline", widget.headline);
  params.set("mediaSource", widget.source);
  params.set("mediaUrl", widget.originalUrl);

  return `/initiatives?${params.toString()}`;
}

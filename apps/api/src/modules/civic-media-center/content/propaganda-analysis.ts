import type { PropagandaAnalysisResource } from "@hu/types";

export const PROPAGANDA_ANALYSIS_RESOURCES: readonly PropagandaAnalysisResource[] = [
  {
    id: "euvsdisinfo-analysis",
    name: "EUvsDisinfo",
    focus: "Disinformation and information manipulation",
    explanation:
      "Documents recurring false narratives and explains how information campaigns spread across platforms.",
    websiteUrl: "https://euvsdisinfo.eu/",
    sortOrder: 1,
  },
  {
    id: "dfrlab",
    name: "DFRLab",
    focus: "Information warfare and digital research",
    explanation:
      "Atlantic Council research lab analyzing online influence operations and digital evidence.",
    websiteUrl: "https://dfrlab.org/",
    sortOrder: 2,
  },
  {
    id: "stanford-internet-observatory",
    name: "Stanford Internet Observatory",
    focus: "Platform research and information integrity",
    explanation:
      "Academic research center studying how information spreads and how communities can evaluate sources.",
    websiteUrl: "https://io.stanford.edu/",
    sortOrder: 3,
  },
  {
    id: "first-draft",
    name: "First Draft",
    focus: "Media literacy and verification training",
    explanation:
      "Provides practical guidance for verifying images, videos, and claims before sharing information.",
    websiteUrl: "https://firstdraftnews.org/",
    sortOrder: 4,
  },
  {
    id: "rand-information-warfare",
    name: "RAND Corporation",
    focus: "Information environment research",
    explanation:
      "Research organization publishing analysis on information operations, resilience, and civic preparedness.",
    websiteUrl: "https://www.rand.org/topics/information-warfare.html",
    sortOrder: 5,
  },
  {
    id: "mediawell",
    name: "MediaWell",
    focus: "Misinformation research aggregation",
    explanation:
      "Social Science Research Council hub curating academic research on misinformation and media literacy.",
    websiteUrl: "https://mediawell.ssrc.org/",
    sortOrder: 6,
  },
] as const;

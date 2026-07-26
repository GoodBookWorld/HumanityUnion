import type {
  CivicMediaAssistantReference,
  CivicMediaCategoriesListing,
  CivicMediaCenterPublic,
} from "@hu/types";

import { FACT_CHECK_RESOURCES } from "./content/fact-checking.js";
import { CIVIC_MEDIA_INITIATIVE_FLOW } from "./content/initiative-flow.js";
import { PROPAGANDA_ANALYSIS_RESOURCES } from "./content/propaganda-analysis.js";
import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
  CIVIC_MEDIA_SELECTION_PRINCIPLES,
} from "./content/sections.js";
import { TRUSTED_MEDIA_RESOURCES } from "./content/trusted-media.js";
import { TRUSTED_MEDIA_CATEGORIES } from "./content/trusted-media-categories.js";

const UPDATED_AT = "2026-06-27T00:00:00.000Z";

export function getCivicMediaCenter(): CivicMediaCenterPublic {
  return {
    overview: CIVIC_MEDIA_OVERVIEW,
    trustedMediaCategories: [...TRUSTED_MEDIA_CATEGORIES],
    trustedMedia: [...TRUSTED_MEDIA_RESOURCES],
    factChecking: [...FACT_CHECK_RESOURCES],
    propagandaAnalysis: [...PROPAGANDA_ANALYSIS_RESOURCES],
    initiativeFlow: CIVIC_MEDIA_INITIATIVE_FLOW,
    selectionPrinciples: [...CIVIC_MEDIA_SELECTION_PRINCIPLES],
    faq: [...CIVIC_MEDIA_FAQ],
    updatedAt: UPDATED_AT,
  };
}

export function listCivicMediaCategories(): CivicMediaCategoriesListing {
  return {
    trustedMediaCategories: [...TRUSTED_MEDIA_CATEGORIES],
  };
}

export function getCivicMediaRecordsForSearch(): Array<{
  entityId: string;
  title: string;
  summary: string;
  activityArea: string;
  publicUrl: string;
  updatedAt: string;
}> {
  const center = getCivicMediaCenter();
  const records = [
    {
      entityId: "civic-media-center",
      title: "Civic Media Center",
      summary: center.overview.summary,
      activityArea: "media",
      publicUrl: "/media",
      updatedAt: center.updatedAt,
    },
    ...center.trustedMedia.map((resource) => ({
      entityId: `trusted-media-${resource.id}`,
      title: resource.name,
      summary: resource.explanation,
      activityArea: resource.categoryId,
      publicUrl: `/media#trusted-media`,
      updatedAt: center.updatedAt,
    })),
    ...center.factChecking.map((resource) => ({
      entityId: `fact-check-${resource.id}`,
      title: resource.name,
      summary: resource.mission,
      activityArea: "fact-checking",
      publicUrl: `/media#fact-checking`,
      updatedAt: center.updatedAt,
    })),
    ...center.propagandaAnalysis.map((resource) => ({
      entityId: `propaganda-analysis-${resource.id}`,
      title: resource.name,
      summary: resource.explanation,
      activityArea: "propaganda-analysis",
      publicUrl: `/media#propaganda-analysis`,
      updatedAt: center.updatedAt,
    })),
  ];

  return records;
}

const MEDIA_PROMPT_PATTERNS = [
  /\bverify\b/i,
  /\bfact[\s-]?check/i,
  /\bevaluate\b.*\bsource/i,
  /\btrustworthy\b/i,
  /\bpropaganda\b/i,
  /\bdisinformation\b/i,
  /\bnews\b.*\binitiative/i,
  /\binitiative\b.*\bnews/i,
  /\bmedia\b.*\bliteracy/i,
];

export function resolveCivicMediaForAssistant(userPrompt?: string): CivicMediaAssistantReference[] {
  if (!userPrompt) {
    return [];
  }

  const normalized = userPrompt.trim();

  if (!normalized) {
    return [];
  }

  const matchesPrompt = MEDIA_PROMPT_PATTERNS.some((pattern) => pattern.test(normalized));

  if (!matchesPrompt) {
    return [];
  }

  const references: CivicMediaAssistantReference[] = [
    {
      sectionId: "overview",
      title: "Civic Media Center",
      purpose: "Navigate trustworthy information and media literacy resources.",
      href: "/media#overview",
    },
  ];

  if (/\bverify\b/i.test(normalized) || /\bfact[\s-]?check/i.test(normalized)) {
    references.push({
      sectionId: "fact-checking",
      title: "Fact-Checking Resources",
      purpose: "Independent organizations that verify public claims with documented evidence.",
      href: "/media#fact-checking",
    });
  }

  if (/\bsource/i.test(normalized) || /\btrustworthy/i.test(normalized)) {
    references.push({
      sectionId: "trusted-media",
      title: "Trusted Media",
      purpose: "Curated media organizations selected by editorial standards — not popularity.",
      href: "/media#trusted-media",
    });
  }

  if (/\bpropaganda\b/i.test(normalized) || /\bdisinformation\b/i.test(normalized)) {
    references.push({
      sectionId: "propaganda-analysis",
      title: "Propaganda Analysis",
      purpose: "Organizations that study information manipulation and media literacy.",
      href: "/media#propaganda-analysis",
    });
  }

  if (/\bnews\b/i.test(normalized) && /\binitiative/i.test(normalized)) {
    references.push({
      sectionId: "initiative-flow",
      title: "How News Creates Initiatives",
      purpose: "Educational flow from verified news to constructive civic participation.",
      href: "/media#initiative-flow",
    });
    references.push({
      sectionId: "news-widgets",
      title: "News Widgets",
      purpose: "Live news cards linking verified stories to initiative creation.",
      href: "/media#news-widgets",
    });
  }

  return references.slice(0, 5);
}

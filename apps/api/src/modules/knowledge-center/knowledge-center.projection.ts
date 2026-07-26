import type { CivicSearchMetadata } from "@hu/types";

import type { KnowledgeArticleRecord } from "./content/article-factory.js";

export function knowledgeArticleToSearchMetadata(
  article: KnowledgeArticleRecord,
): CivicSearchMetadata {
  return {
    entityType: "knowledge_article",
    entityId: article.slug,
    title: article.title,
    summary: `${article.purpose} ${article.overview}`,
    country: "",
    region: "",
    community: "",
    activityArea: article.categoryId,
    status: "published",
    publicUrl: `/knowledge/${article.slug}`,
    updatedAt: article.updatedAt,
  };
}

export const KNOWLEDGE_ASSISTANT_CAPABILITY_MAP: Record<string, string[]> = {
  improve_title: ["what-is-an-initiative"],
  clarify_summary: ["what-is-an-initiative", "collaborative-analysis"],
  check_missing_fields: ["what-is-an-initiative"],
  explain_compatibility_review: ["collaborative-analysis"],
  strengthen_evidence: ["prepare-good-evidence", "collaborative-analysis"],
  identify_risks: ["collaborative-analysis"],
  structure_analysis: ["collaborative-analysis"],
  structure_proposal: ["improvement-proposal", "write-better-proposals"],
  draft_revision_summary: ["improvement-proposal"],
  explain_decision_session: ["decision-session"],
  explain_decision_result: ["collective-decision", "understand-decision-results"],
  prepare_cap_summary: ["civic-action-package", "cap-glossary"],
  suggest_recipient_categories: ["how-initiatives-reach-institutions", "institution-levels"],
  prepare_delivery_message: ["how-delivery-works", "civic-action-package"],
  summarize_official_response: ["official-response", "how-official-responses-appear"],
  prepare_accountability_event: ["civic-accountability", "how-civic-accountability-works"],
  structure_implementation_update: ["implementation-tracking", "track-implementation"],
  clarify_public_impact: ["public-impact", "prepare-public-impact"],
  prepare_archive_lessons: ["public-civic-archive", "archive-experience"],
  explain_pipeline_status: ["capability02-civic-pipeline"],
  review_related_records: ["capability02-civic-pipeline", "reference-only-architecture"],
  identify_next_step: ["capability02-civic-pipeline", "workspace"],
  explain_current_section: ["workspace", "ai-assistant"],
};

export const KNOWLEDGE_SECTION_TAG_MAP: Record<string, string[]> = {
  Initiatives: ["what-is-an-initiative", "create-your-first-initiative"],
  "Collaborative Analysis": ["collaborative-analysis"],
  "Improvement Proposals": ["improvement-proposal"],
  "Decision Sessions": ["decision-session"],
  "Collective Decisions": ["collective-decision"],
  "Implementation Commitments": ["implementation-commitment"],
  "Implementation Tracking": ["implementation-tracking"],
  "Public Impact": ["public-impact"],
  "Civic Archive": ["public-civic-archive"],
  "Participation Area": ["participation-areas"],
  Notifications: ["notifications"],
  "Workspace Home": ["workspace", "platform-overview"],
};

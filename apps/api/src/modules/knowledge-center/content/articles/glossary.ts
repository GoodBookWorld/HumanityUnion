import { article } from "../article-factory.js";

function glossaryEntry(
  slug: string,
  title: string,
  definition: string,
  sortOrder: number,
  relatedSlug?: string,
) {
  return article({
    slug,
    categoryId: "glossary",
    title,
    purpose: `What does "${title}" mean on Humanity Union?`,
    overview: definition,
    diagramId: "process-flow",
    explanation: [{ id: "definition", heading: "Definition", body: definition }],
    keyConcepts: [title],
    relatedConceptSlugs: relatedSlug ? [relatedSlug] : [],
    relatedGuideSlugs: [],
    relatedPublicPageHrefs: [],
    readingTimeMinutes: 1,
    searchTerms: [title.toLowerCase(), slug.replace(/-/g, " ")],
    assistantTags: [slug],
    sortOrder,
  });
}

export const GLOSSARY_ARTICLES = [
  glossaryEntry(
    "cap-glossary",
    "CAP (Civic Action Package)",
    "A Civic Action Package bundles a collective decision outcome for external delivery.",
    1,
    "civic-action-package",
  ),
  glossaryEntry(
    "steward-glossary",
    "Steward",
    "The participant responsible for an initiative's lifecycle and publication.",
    2,
    "what-is-an-initiative",
  ),
  glossaryEntry(
    "projection-glossary",
    "Projection",
    "A public-safe view of a civic record derived from the source record.",
    3,
    "reference-only-architecture",
  ),
  glossaryEntry(
    "tracking-glossary",
    "Tracking",
    "Implementation tracking documents progress on a published commitment.",
    4,
    "implementation-tracking",
  ),
  glossaryEntry(
    "archive-glossary",
    "Archive",
    "A public civic archive record preserving completed work and lessons.",
    5,
    "public-civic-archive",
  ),
  glossaryEntry(
    "integration-layer-glossary",
    "Integration Layer",
    "The reference-only layer linking civic entities without duplicating workflow logic.",
    6,
    "capability02-civic-pipeline",
  ),
  glossaryEntry(
    "public-impact-glossary",
    "Public Impact",
    "A published summary of observed outcomes with supporting evidence references.",
    7,
    "public-impact",
  ),
  glossaryEntry(
    "participation-area-glossary",
    "Participation Area",
    "A declared geographic scope determining where a participant may engage.",
    8,
    "participation-areas",
  ),
  glossaryEntry(
    "decision-session-glossary",
    "Decision Session",
    "A published framing record before a collective decision opens.",
    9,
    "decision-session",
  ),
  glossaryEntry(
    "collective-decision-glossary",
    "Collective Decision",
    "A governed vote or consensus record with transparent results.",
    10,
    "collective-decision",
  ),
  glossaryEntry(
    "official-response-glossary",
    "Official Response",
    "A published institutional reply linked to civic delivery.",
    11,
    "official-response",
  ),
  glossaryEntry(
    "civic-accountability-glossary",
    "Civic Accountability",
    "Follow-up records tracking obligations after responses or commitments.",
    12,
    "civic-accountability",
  ),
];

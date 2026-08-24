/**
 * Pack 16D — Blog publication authoring Assistant context helpers.
 * Reuses the platform LifecycleAiProvider /assistant seam (no Blog-only AI stack).
 */

import type { InitiativeLifecycleAiAssistOperation } from "@hu/types";

/** Excerpt bridge + Apply event stage key for the publication editor. */
export const BLOG_AUTHORING_ASSISTANT_STAGE_KEY = "blog_authoring" as const;

export const BLOG_PUBLICATION_ASSISTANT_SECTION_IDS = [
  "title",
  "content",
  "clarity",
  "structure",
  "seoTitle",
  "seoDescription",
  "keywords",
  "socialTitle",
  "socialDescription",
] as const;

export type BlogPublicationAssistantSectionId =
  (typeof BLOG_PUBLICATION_ASSISTANT_SECTION_IDS)[number];

/** Draft-oriented ops for the publication editor only (never auto-publish). */
export const BLOG_PUBLICATION_AUTHORING_OPS: readonly InitiativeLifecycleAiAssistOperation[] = [
  "explain",
  "summarize_source_themes",
  "identify_missing_information",
  "improve_wording",
  "answer_question",
  "generate_draft",
  "regenerate_section",
];

const BLOG_AUTHORING_INSTRUCTION_EXTRA = [
  "CONTEXT: AUTHORING — Humanity Union Blog publication editor.",
  "You may suggest title, wording, clarity, structure, SEO title, meta description, keywords/topics, and social preview text.",
  "Return structured suggestions with Section: <fieldId> markers when proposing field text.",
  "Known field ids: title, content, clarity, structure, seoTitle, seoDescription, keywords, socialTitle, socialDescription.",
  "Never publish, submit for review, approve, grant Author rights, or silently rewrite stored content.",
  "The Author must explicitly Apply / Replace / Dismiss every suggestion. Preserve Author ownership of the final text.",
].join(" ");

/**
 * True for the canonical publication editor routes only
 * (`/workspace/publishing/new` and `/workspace/publishing/:postId`).
 * Excludes the publishing dashboard and preview.
 */
export function isBlogPublicationAuthoringPath(pagePath?: string | null): boolean {
  if (!pagePath) {
    return false;
  }
  const path = pagePath.split(/[?#]/)[0] ?? "";
  if (path === "/workspace/publishing/new") {
    return true;
  }
  if (path.endsWith("/preview")) {
    return false;
  }
  return /^\/workspace\/publishing\/[^/]+$/.test(path);
}

export function blogAuthoringInstructionBlock(baseInstructionBlock: string): string {
  return `${baseInstructionBlock} ${BLOG_AUTHORING_INSTRUCTION_EXTRA}`;
}

export function buildBlogAuthoringSourceContext(input: {
  readonly pagePath?: string;
  readonly draftExcerpt?: string;
}): string {
  const excerpt = input.draftExcerpt?.trim()
    ? input.draftExcerpt.trim().slice(0, 4000)
    : "(no draft excerpt provided by Author)";
  return [
    "Stage: AUTHORING",
    "Surface: Blog publication editor",
    `Page: ${input.pagePath ?? "/workspace/publishing"}`,
    "Publication metadata and draft text below were supplied by the Author for this authorized Assistant request only.",
    "Do not treat this as a public record.",
    "",
    excerpt,
  ].join("\n");
}

/**
 * Pack 16D — Blog publication authoring Assistant (API).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BLOG_PUBLICATION_AUTHORING_OPS,
  blogAuthoringInstructionBlock,
  buildBlogAuthoringSourceContext,
  isBlogPublicationAuthoringPath,
} from "../../../src/modules/lifecycle-ai/blog-authoring-assistant.js";
import { resolveAssistantSpecialization } from "../../../src/modules/lifecycle-ai/assistant-specialization.js";
import { DeterministicLifecycleAiProvider } from "../../../src/modules/lifecycle-ai/providers/deterministic-lifecycle-ai-provider.js";

describe("Pack 16D — authoring Humanity Union Assistant (API)", () => {
  it("detects publication editor paths only", () => {
    assert.equal(isBlogPublicationAuthoringPath("/workspace/publishing/new"), true);
    assert.equal(isBlogPublicationAuthoringPath("/workspace/publishing/blog-123"), true);
    assert.equal(isBlogPublicationAuthoringPath("/workspace/publishing"), false);
    assert.equal(isBlogPublicationAuthoringPath("/workspace/publishing/blog-123/preview"), false);
    assert.equal(isBlogPublicationAuthoringPath("/blog/some-slug"), false);
    assert.equal(isBlogPublicationAuthoringPath("/workspace/authoring"), false);
  });

  it("keeps educational blog specialization apply-false while authoring ops exist", () => {
    const specialization = resolveAssistantSpecialization("blog");
    assert.equal(specialization.canApplySuggestionsToDraft, false);
    assert.ok(BLOG_PUBLICATION_AUTHORING_OPS.includes("improve_wording"));
    assert.ok(BLOG_PUBLICATION_AUTHORING_OPS.includes("regenerate_section"));
    assert.match(blogAuthoringInstructionBlock(specialization.instructionBlock), /AUTHORING/i);
    assert.match(blogAuthoringInstructionBlock(specialization.instructionBlock), /never publish/i);
  });

  it("builds AUTHORING source context from Author-supplied excerpt only", () => {
    const context = buildBlogAuthoringSourceContext({
      pagePath: "/workspace/publishing/new",
      draftExcerpt: "title: Hello\ncontent:\nBody text",
    });
    assert.match(context, /Stage: AUTHORING/);
    assert.match(context, /title: Hello/);
    assert.match(context, /authorized Assistant request/);
  });

  it("deterministic provider returns sectioned blog authoring suggestions", async () => {
    const provider = new DeterministicLifecycleAiProvider();
    const result = await provider.assist({
      initiativeId: "platform",
      stageId: "initiative",
      stageLabel: "Publication Authoring",
      operation: "regenerate_section",
      participantDisplayName: "Author",
      initiativeTitle: "Draft",
      presentationMode: "author_workspace",
      availableSourceLabels: ["Author-provided publication draft excerpt"],
      instructions: "Suggest an SEO title for search results",
      targetSectionId: "seoTitle",
      currentDraftExcerpt: "title: Civic Care\ncontent:\nHello",
      sourceContextSummary: "Stage: AUTHORING\nSurface: Blog publication editor",
      surfaceId: "blog",
      featureLabel: "Publication Authoring",
      prompt: { systemPrompt: "sys", userPrompt: "user" },
    });

    assert.equal(result.isPlaceholder, false);
    assert.ok(result.suggestions.length >= 1);
    assert.equal(result.suggestions[0]?.targetSectionId, "seoTitle");
    assert.ok(result.suggestions[0]?.suggestedText.includes("Civic Care"));
  });
});

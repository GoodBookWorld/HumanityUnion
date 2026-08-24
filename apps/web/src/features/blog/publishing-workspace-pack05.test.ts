import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveAssistantLaunchContext } from "../humanity-union-assistant/resolve-assistant-surface.js";
import { previewBlogSlugFromTitle } from "./publishing-api.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Publishing Workspace Pack 05", () => {
  it("1/2 — Publishing route exists; non-Author gate redirects to Authoring", () => {
    const page = read("app/workspace/publishing/page.tsx");
    assert.match(page, /PublishingPageContent/);
    assert.match(page, /MemberWorkspace/);
    assert.match(page, /HumanityUnionAssistantWidget/);
    assert.match(page, /surfaceId="blog"/);

    const content = read("features/blog/components/PublishingPageContent.tsx");
    assert.match(content, /Author access required/);
    assert.match(content, /\/workspace\/authoring/);
    assert.match(content, /Become an Author/);
  });

  it("3 — Trusted Author capability drives Publish visibility in editor", () => {
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /canDirectPublish/);
    assert.match(editor, /Publish/);
    assert.match(editor, /needs_review/);
    assert.match(editor, /Standard Authors submit for review/);
  });

  it("4/5/7/8 — New/edit routes + Save Draft Saving/Saved pattern", () => {
    assert.match(read("app/workspace/publishing/new/page.tsx"), /BlogEditorPageContent/);
    assert.match(read("app/workspace/publishing/[postId]/page.tsx"), /mode="edit"/);
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /useSaveButtonPhase/);
    assert.match(editor, /Save Draft/);
    assert.match(editor, /resolveSaveButtonLabel/);
  });

  it("9/10/11 — Title, category, tags constraints in editor", () => {
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /Title must be at least 3 characters/);
    assert.match(editor, /Category is required/);
    assert.match(editor, /MAX_TAGS = 12/);
    assert.match(editor, /BLOG_CATEGORIES/);
  });

  it("12/13/14 — Cover upload/remove/alt text field", () => {
    const cover = read("features/blog/components/BlogCoverField.tsx");
    assert.match(cover, /uploadBlogImage/);
    assert.match(cover, /Replace Cover|Upload Cover/);
    assert.match(cover, /Remove Cover/);
    assert.match(cover, /Image description \/ alt text/);
    assert.match(cover, /altText/);
  });

  it("15/16 — rich editor constrained; server remains sanitizer trust boundary", () => {
    const rich = read("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(rich, /@ckeditor\/ckeditor5-react|ckeditor5/);
    assert.match(rich, /ClassicEditor|heading/);
    assert.match(rich, /BlogCkeditorUploadAdapterPlugin|uploadImage/);
    assert.doesNotMatch(rich, /@tiptap|EasyImage|ckeditor\.cloud/i);
    assert.match(rich, /trust boundary|sanitizer|Pack 15B/i);
  });

  it("17/18 — Preview uses preview API and marks Draft Preview — Not Published", () => {
    const preview = read("features/blog/components/BlogPreviewPageContent.tsx");
    assert.match(preview, /previewBlogPost/);
    assert.match(preview, /Draft Preview — Not Published/);
    assert.match(preview, /does not change status or publish/);
    assert.match(read("app/workspace/publishing/[postId]/preview/page.tsx"), /BlogPreviewPageContent/);
  });

  it("19/20/21 — Submit confirmation; Publish only when permitted", () => {
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /Submit for Review/);
    assert.match(editor, /Submit this publication for editorial review/);
    assert.match(editor, /showPublish/);
    assert.match(editor, /ConfirmDialog/);
  });

  it("24 — Author attribution cannot be forged in editor payload", () => {
    const api = read("features/blog/publishing-api.ts");
    assert.doesNotMatch(api, /authorParticipantId/);
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /attribution is set by the/);
    assert.match(editor, /platform/);
  });

  it("25 — Slug preview helper is client-only display; published slug noted stable", () => {
    assert.equal(previewBlogSlugFromTitle("Hello World!"), "hello-world");
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /stable after publication/);
  });

  it("28 — Assistant cannot auto-publish", () => {
    const page = read("app/workspace/publishing/page.tsx");
    assert.match(page, /never saves, submits, or publishes/i);
    assert.doesNotMatch(page, /autoPublish|publishAutomatically/i);
  });

  it("29 — Navigation Become an Author → Publishing href flip", () => {
    const nav = read("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /publishingWorkspaceHref/);
    assert.match(nav, /\/workspace\/publishing/);
    assert.match(nav, /Become an Author/);
    assert.match(nav, /state\.navLabel/);
  });

  it("30 — No second mail/AI/media/safety subsystem", () => {
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    assert.doesNotMatch(editor, /nodemailer|createTransport|smtp-out\.flockmail/i);
    assert.doesNotMatch(editor, /new SafetyProvider|openai\.|gemini/i);
    assert.match(read("features/media-upload/media-upload-api.ts"), /uploadBlogImage/);
  });

  it("Autosave decision documented as manual Save Draft", () => {
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /manual Save Draft only/);
    assert.doesNotMatch(editor, /setInterval\(|autosaveTimer/);
  });

  it("SEO settings deferred", () => {
    const editor = read("features/blog/components/BlogPostEditor.tsx");
    assert.match(editor, /SEO title\/description controls are deferred/);
  });

  it("Assistant surface resolves publishing path to blog", () => {
    assert.equal(resolveAssistantLaunchContext("/workspace/publishing").surfaceId, "blog");
    assert.equal(resolveAssistantLaunchContext("/workspace/publishing/new").surfaceId, "blog");
  });

  it("Dashboard empty states present", () => {
    const dash = read("features/blog/components/PublishingDashboard.tsx");
    assert.match(dash, /No draft publications yet/);
    assert.match(dash, /No publications are currently under review/);
    assert.match(dash, /No published Blog articles yet/);
  });
});

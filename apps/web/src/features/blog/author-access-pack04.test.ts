import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { DESKTOP_CAPSULE_NAVIGATION } from "../public-experience/constants.js";
import { FOOTER_PLATFORM_COLUMN_ONE } from "../public-experience/footer-links.js";
import { resolveAssistantLaunchContext } from "../humanity-union-assistant/resolve-assistant-surface.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Author Access Pack 04 — Workspace Authoring & Knowledge Blog entry", () => {
  it("1 — Become an Author state and route exist", () => {
    const page = read("app/workspace/authoring/page.tsx");
    assert.match(page, /AuthoringPageContent/);
    assert.match(page, /MemberWorkspace/);

    const content = read("features/blog/components/AuthoringPageContent.tsx");
    assert.match(content, /Become a Blog Author/);
    assert.match(content, /canApply/);
    assert.match(content, /BLOG_CATEGORIES/);
    assert.match(content, /conscious_existence/);
    assert.match(content, /human_security/);
    assert.match(content, /our_life/);
  });

  it("2/16 — Application status presentations and changes-requested resubmit", () => {
    const content = read("features/blog/components/AuthoringPageContent.tsx");
    assert.match(content, /application_submitted/);
    assert.match(content, /application_under_review/);
    assert.match(content, /application_changes_requested/);
    assert.match(content, /application_declined/);
    assert.match(content, /canResubmit/);
    assert.match(content, /Resubmit application/);
  });

  it("8 — Sensitive personal data not requested in form", () => {
    const content = read("features/blog/components/AuthoringPageContent.tsx");
    assert.doesNotMatch(content, /religion|ethnicity|political affiliation|ideology/i);
    assert.match(content, /agreedToStandards/);
    assert.match(content, /previousWritingUrl|previous writing/i);
  });

  it("12 — Approved Author Publishing-ready state links to Publishing Workspace", () => {
    const content = read("features/blog/components/AuthoringPageContent.tsx");
    assert.match(content, /You can now create and submit Blog publications/);
    assert.match(content, /publishingWorkspaceHref/);
    assert.match(content, /Open Publishing/);
  });

  it("13/14 — Trusted Author and Editor/Admin copy", () => {
    const content = read("features/blog/components/AuthoringPageContent.tsx");
    assert.match(content, /Trusted Authors may publish/);
    assert.match(content, /Safety cannot be bypassed|unless Safety requires review/);
    assert.match(content, /Editorial access/);
    assert.match(content, /Editorial Review/);
    assert.doesNotMatch(content, /future Administration \/ Editorial surface/);
  });

  it("20/21 — Knowledge contains Blog entry linking to /blog", () => {
    const knowledge = read("features/knowledge-center/components/KnowledgeCenterPageContent.tsx");
    assert.match(knowledge, /knowledge-blog-entry/);
    assert.match(knowledge, /Read publications and reflections from Humanity Union authors/);
    assert.match(knowledge, /href="\/blog"/);
  });

  it("22 — Header remains five capsule links including Knowledge", () => {
    assert.equal(DESKTOP_CAPSULE_NAVIGATION.length, 5);
    assert.ok(DESKTOP_CAPSULE_NAVIGATION.some((item) => item.label === "Knowledge"));
    assert.ok(!DESKTOP_CAPSULE_NAVIGATION.some((item) => item.label === "Blog"));
  });

  it("23 — Footer Blog remains", () => {
    assert.ok(FOOTER_PLATFORM_COLUMN_ONE.some((item) => item.label === "Blog" && item.href === "/blog"));
  });

  it("Workspace nav has one evolving Authoring/Publishing entry", () => {
    const nav = read("features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /\/workspace\/authoring/);
    assert.match(nav, /\/workspace\/publishing/);
    assert.match(nav, /Become an Author/);
    assert.match(nav, /state\.navLabel/);
    assert.match(nav, /publishingWorkspaceHref/);
    assert.match(nav, /fetchBlogAuthoringAccessState/);

    // Pack 04 types/API define the approved Publishing label for Authors.
    const typesBlog = readFileSync(
      path.resolve(webSrc, "../../../packages/types/src/domain/blog.ts"),
      "utf8",
    );
    assert.match(typesBlog, /navLabel: "Become an Author" \| "Publishing"/);
  });

  it("Assistant surface resolves blog for authoring, publishing, and public blog", () => {
    assert.equal(resolveAssistantLaunchContext("/workspace/authoring").surfaceId, "blog");
    assert.equal(resolveAssistantLaunchContext("/workspace/publishing").surfaceId, "blog");
    assert.equal(resolveAssistantLaunchContext("/blog").surfaceId, "blog");
  });

  it("Authoring API never sends applicantParticipantId as authority", () => {
    const api = read("features/blog/authoring-api.ts");
    assert.match(api, /\/api\/v1\/blog\/author-applications/);
    assert.match(api, /\/api\/v1\/blog\/authoring/);
    assert.doesNotMatch(api, /applicantParticipantId/);
  });

  it("No second Participant model introduced in Authoring UI", () => {
    const content = read("features/blog/components/AuthoringPageContent.tsx");
    assert.doesNotMatch(content, /AuthorIdentity|separate identity|author user id/i);
  });
});

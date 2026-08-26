import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { BLOG_PAGE_SIZE, formatBlogPublishedDate } from "../features/blog/api.js";
import { HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX } from "../features/public-home-v2/hero-unity-visual.constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "..");
const repoRoot = path.resolve(webSrc, "../../..");

function readWeb(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

function readApi(relativeFromApiSrc: string): string {
  return readFileSync(path.join(repoRoot, "apps/api/src", relativeFromApiSrc), "utf8");
}

describe("Launch Readiness Pack 06 — Performance & Runtime Efficiency", () => {
  it("1 — Home Earth visual skips ≤768px and uses lightweight SVG/CSS (no WebGL)", () => {
    assert.equal(HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX, 769);
    const visual = readWeb("features/public-home-v2/components/HumanityUnityVisual.tsx");
    const globe = readWeb("features/public-home-v2/components/HumanityGlobe.tsx");

    assert.match(visual, /dynamic\(/);
    assert.match(visual, /ssr:\s*false/);
    assert.match(visual, /min-width:\s*769px/);
    assert.match(visual, /mountGlobe/);
    assert.doesNotMatch(globe, /WebGLRenderer|setPixelRatio|from ["']three["']/);
    assert.match(globe, /hero-unity-globe__earth|HUMANITY_UNITY_EARTH_SRC/);
    assert.match(globe, /aria-hidden="true"/);
  });

  it("2 — Rich editor stays on publishing paths, not public Blog presentation", () => {
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    const body = readWeb("features/blog/components/BlogArticleBody.tsx");
    const index = readWeb("features/blog/components/BlogIndexPageContent.tsx");
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    const rich = readWeb("features/blog/components/BlogRichTextEditor.tsx");

    assert.doesNotMatch(article, /@tiptap|@ckeditor|BlogRichTextEditor/);
    assert.doesNotMatch(body, /@tiptap|@ckeditor|BlogRichTextEditor/);
    assert.doesNotMatch(index, /@tiptap|@ckeditor|BlogRichTextEditor/);
    assert.match(editor, /BlogRichTextEditor/);
    assert.match(rich, /ssr:\s*false|@ckeditor\/ckeditor5-react|ckeditor5/);
    const client = readWeb("features/blog/components/BlogRichTextEditorClient.tsx");
    assert.match(client, /@ckeditor\/ckeditor5-react|ckeditor5/);
  });

  it("3 — Blog list page size is bounded", () => {
    assert.equal(BLOG_PAGE_SIZE, 9);
    assert.ok(BLOG_PAGE_SIZE <= 50);
  });

  it("4 — Message history pages remain bounded (API)", () => {
    const service = readApi("modules/direct-messaging/direct-messaging.service.ts");
    assert.match(service, /RECENT_MESSAGES_PAGE_SIZE = 30/);
    assert.match(service, /OLDER_MESSAGES_PAGE_SIZE = 30/);
    assert.match(service, /findDirectMessageById/);
    assert.doesNotMatch(service, /ANCHOR_SCAN_LIMIT/);
  });

  it("5 — Community Intelligence remains capped", () => {
    const constants = readApi("modules/community-intelligence/community-intelligence.constants.ts");
    assert.match(constants, /COMMUNITY_INTELLIGENCE_MAX_CANDIDATES = 80/);
    assert.match(constants, /COMMUNITY_INTELLIGENCE_MAX_RELATED = 5/);
    assert.match(constants, /COMMUNITY_INTELLIGENCE_CACHE_TTL_MS = 60_000/);
  });

  it("6 — Translation cache identity remains version-aware", () => {
    const keyHelper = readApi("modules/language/translation-cache-key.ts");
    assert.match(keyHelper, /sourceRecordId/);
    assert.match(keyHelper, /sourceVersion/);
    assert.match(keyHelper, /targetLanguage/);
    assert.match(keyHelper, /\.join\("::"\)/);
  });

  it("7 — Assistant conversation history bounds remain enforced", () => {
    const optimizer = readApi("modules/lifecycle-ai/assistant-context-optimizer.ts");
    assert.match(optimizer, /export function boundConversationHistory/);
    assert.match(optimizer, /history\.slice\(-maxTurns\)/);
    assert.match(optimizer, /truncateText/);
    assert.match(optimizer, /enforcePromptBudget/);
  });

  it("8 — Home Earth composition stays CSS/SVG without WebGL teardown requirements", () => {
    const globe = readWeb("features/public-home-v2/components/HumanityGlobe.tsx");
    assert.doesNotMatch(globe, /renderer\.dispose|WebGLRenderer|disposables/);
    assert.match(globe, /hero-unity-globe__layer--rear/);
    assert.match(globe, /hero-unity-globe__layer--front/);
    assert.match(globe, /aria-hidden="true"/);
  });

  it("9 — Authenticated API client fetches use no-store", () => {
    const client = readWeb("lib/api-client.ts");
    assert.match(client, /cache:\s*"no-store"/);
  });

  it("10 — Quarantined Lifecycle Assistant modal is not barrel-exported", () => {
    const barrel = readWeb("features/lifecycle-ai-assistant/index.ts");
    assert.doesNotMatch(barrel, /LifecycleAiAssistantModal/);
    assert.match(barrel, /Pack 02 quarantine/i);
  });

  it("11 — Blog published dates use deterministic locale", () => {
    const formatted = formatBlogPublishedDate("2024-06-15T12:00:00.000Z");
    assert.match(formatted, /June/);
    assert.match(formatted, /15/);
    assert.match(formatted, /2024/);
    const api = readWeb("features/blog/api.ts");
    assert.match(api, /DateTimeFormat\("en"/);
  });

  it("12 — Assistant Host lazy-loads modal via next/dynamic", () => {
    const host = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantHost.tsx",
    );
    assert.match(host, /next\/dynamic/);
    assert.match(host, /HumanityUnionAssistantModal/);
    assert.match(host, /ssr:\s*false/);
    assert.match(host, /everOpened/);
    assert.doesNotMatch(
      host,
      /import \{[^}]*HumanityUnionAssistantModal[^}]*\} from ["']\.\/HumanityUnionAssistantModal["']/,
    );
  });

  it("13 — Search and Blog list support AbortController", () => {
    const searchApi = readWeb("features/global-search/api.ts");
    const blogApi = readWeb("features/blog/api.ts");
    const searchPage = readWeb("features/global-search/components/GlobalSearchPageContent.tsx");
    const blogIndex = readWeb("features/blog/components/BlogIndexPageContent.tsx");

    assert.match(searchApi, /signal\?: AbortSignal/);
    assert.match(blogApi, /signal\?: AbortSignal/);
    assert.match(searchPage, /AbortController/);
    assert.match(blogIndex, /AbortController/);
  });

  it("14 — Blog article page seeds client from SSR initialPost", () => {
    const page = readWeb("app/blog/[slug]/page.tsx");
    const content = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    assert.match(page, /initialPost=/);
    assert.match(page, /fetchPublicBlogPostBySlugOptional/);
    assert.match(content, /initialPost\?:/);
    assert.match(content, /seeded/);
  });

  it("15 — Mongo connectPromise resets after failed connect", () => {
    const connection = readApi("infrastructure/mongodb/mongo-connection.ts");
    assert.match(connection, /connectPromise = null/);
    assert.match(connection, /Launch Readiness Pack 06/);
  });
});

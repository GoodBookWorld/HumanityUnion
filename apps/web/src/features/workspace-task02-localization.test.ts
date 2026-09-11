/**
 * Task 02 — Workspace Initiatives / Publishing / Editorial WEB_UI reconnect.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveActivityAreaDisplayLabel,
  resolveLifecyclePhaseDisplayLabel,
} from "./public-initiative-experience/initiative-experience-i18n.js";
import { resolveBlogCategoryDisplayName } from "./blog/resolve-blog-category-display-name.js";
import {
  resolveEditorialPublicationStatusLabel,
  resolveEditorialReviewStatusLabel,
  resolveEditorialSafetyOutcomeLabel,
  resolvePublishingListStatusLabel,
} from "./blog/blog-workspace-i18n.js";
import { INITIATIVE_LIFECYCLE_PHASE_LABELS } from "./initiatives/initiative-lifecycle-labels.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function messages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(path.join(webSrc, `features/i18n/messages/${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

function tFromCatalog(
  catalog: Record<string, unknown>,
  namespace: string,
): ((key: string, values?: Record<string, string | number | Date>) => string) & {
  has: (key: string) => boolean;
} {
  const parts = namespace.split(".");
  let ns: unknown = catalog;
  for (const part of parts) {
    ns = (ns as Record<string, unknown>)[part];
  }
  const root = ns as Record<string, unknown>;

  const resolve = (key: string): string | undefined => {
    const segs = key.split(".");
    let cur: unknown = root;
    for (const seg of segs) {
      if (!cur || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return typeof cur === "string" ? cur : undefined;
  };

  const t = ((key: string, values?: Record<string, string | number | Date>) => {
    const raw = resolve(key) ?? key;
    if (!values) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
  }) as ((key: string, values?: Record<string, string | number | Date>) => string) & {
    has: (key: string) => boolean;
  };
  t.has = (key: string) => typeof resolve(key) === "string";
  return t;
}

describe("Task 02 — Workspace Initiatives / Publishing / Editorial localization", () => {
  it("A. Initiatives: phase/activity resolvers + chrome; no English phase map on card", () => {
    const card = readWeb("features/initiatives/components/InitiativeCard.tsx");
    assert.match(card, /resolveLifecyclePhaseDisplayLabel/);
    assert.match(card, /resolveActivityAreaDisplayLabel/);
    assert.match(card, /useInitiativeCardTitlePresentation/);
    assert.match(card, /useTranslations\("workspace\.initiativesPage"\)/);
    assert.doesNotMatch(card, /INITIATIVE_LIFECYCLE_PHASE_LABELS/);
    assert.doesNotMatch(card, /Manage Initiative/);
    assert.doesNotMatch(card, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);

    const uk = messages("uk");
    const tExp = tFromCatalog(uk, "initiativeExperience");
    const tPage = tFromCatalog(uk, "workspace.initiativesPage");

    const phase = resolveLifecyclePhaseDisplayLabel("draft", tExp);
    assert.equal(phase, tExp("phases.draft"));
    assert.notEqual(phase, INITIATIVE_LIFECYCLE_PHASE_LABELS.draft);

    const area = resolveActivityAreaDisplayLabel("Human Rights", tExp);
    assert.equal(area, tExp("activityAreas.humanRights"));
    assert.notEqual(area, "Human Rights");

    assert.equal(tPage("myInitiatives"), "Мої ініціативи");
    assert.equal(tPage("sections.draft"), "Мої чернетки");
    assert.equal(tPage("openInitiative"), "Відкрити ініціативу");
  });

  it("B. Publishing: Blog category resolver + status/chrome WEB_UI", () => {
    const list = readWeb("features/blog/components/PublicationListItem.tsx");
    const dashboard = readWeb("features/blog/components/PublishingDashboard.tsx");
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");

    assert.match(list, /resolveBlogCategoryDisplayName/);
    assert.match(list, /resolvePublishingListStatusLabel/);
    assert.doesNotMatch(list, /BLOG_CATEGORIES\.find/);
    assert.match(dashboard, /useTranslations\("workspace\.publishingPage"\)/);
    assert.doesNotMatch(dashboard, /New Publication/);
    assert.match(editor, /resolveBlogCategoryDisplayName\(entry\.categoryId/);
    assert.doesNotMatch(editor, /\{entry\.name\}/);

    const uk = messages("uk");
    const tBlog = tFromCatalog(uk, "blogPublic");
    const tPub = tFromCatalog(uk, "workspace.publishingPage");

    assert.equal(
      resolveBlogCategoryDisplayName("conscious_existence", tBlog),
      tBlog("categories.conscious_existence.name"),
    );
    assert.notEqual(
      resolveBlogCategoryDisplayName("conscious_existence", tBlog),
      "Conscious Existence",
    );

    const status = resolvePublishingListStatusLabel(
      {
        status: "draft",
        review: { reviewStatus: "changes_requested" },
      } as Parameters<typeof resolvePublishingListStatusLabel>[0],
      tPub,
    );
    assert.equal(status, tPub("status.changes_requested"));
    assert.equal(tPub("tabs.draft"), "Чернетки");
    assert.equal(tPub("newPublication"), "Нова публікація");
  });

  it("C. Editorial: same category resolver + queue/status presentation", () => {
    const queue = readWeb("features/blog/components/EditorialQueuePageContent.tsx");
    const review = readWeb("features/blog/components/EditorialReviewPageContent.tsx");

    assert.match(queue, /resolveBlogCategoryDisplayName/);
    assert.match(queue, /resolveEditorialSafetyOutcomeLabel/);
    assert.match(queue, /useTranslations\("workspace\.editorialPage"\)/);
    assert.doesNotMatch(queue, /Safety: \$\{/);
    assert.doesNotMatch(queue, /Editorial: \$\{item\.review\.reviewStatus\}/);

    assert.match(review, /resolveBlogCategoryDisplayName/);
    assert.match(review, /resolveEditorialPublicationStatusLabel/);
    assert.doesNotMatch(review, /BLOG_CATEGORIES\.find/);
    assert.doesNotMatch(review, /Safety: \{safety/);

    const uk = messages("uk");
    const tEd = tFromCatalog(uk, "workspace.editorialPage");
    const tBlog = tFromCatalog(uk, "blogPublic");

    assert.equal(
      resolveBlogCategoryDisplayName("human_security", tBlog),
      tBlog("categories.human_security.name"),
    );
    assert.equal(
      resolveEditorialPublicationStatusLabel("submitted_for_review", "pending", tEd),
      tEd("publicationStatuses.submitted_for_review"),
    );
    assert.equal(resolveEditorialReviewStatusLabel("changes_requested", tEd), "Запитано зміни");
    assert.equal(
      tEd("safetyLabel", {
        outcome: resolveEditorialSafetyOutcomeLabel("needs_review", tEd),
      }),
      "Безпека: потрібен перегляд",
    );
    assert.equal(tEd("pendingHeading"), "Очікує перегляду");
  });

  it("D. Architecture: no locale branching; catalog keys present across fixtures", () => {
    for (const file of [
      "features/initiatives/components/InitiativeCard.tsx",
      "features/blog/components/PublishingDashboard.tsx",
      "features/blog/components/EditorialQueuePageContent.tsx",
      "features/blog/components/EditorialReviewPageContent.tsx",
      "features/blog/blog-workspace-i18n.ts",
    ]) {
      const src = readWeb(file);
      assert.doesNotMatch(src, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);
      assert.doesNotMatch(src, /switch\s*\(\s*locale\s*\)/);
      assert.doesNotMatch(src, /gemini|callProvider|provider-on-read/i);
    }

    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const catalog = messages(locale);
      const workspace = catalog.workspace as Record<string, unknown>;
      assert.equal(typeof (workspace.initiativesPage as { title: string }).title, "string");
      assert.equal(typeof (workspace.publishingPage as { title: string }).title, "string");
      assert.equal(typeof (workspace.editorialPage as { title: string }).title, "string");
    }

    const en = tFromCatalog(messages("en"), "workspace.publishingPage");
    const uk = tFromCatalog(messages("uk"), "workspace.publishingPage");
    assert.notEqual(uk("title"), en("title"));
  });
});

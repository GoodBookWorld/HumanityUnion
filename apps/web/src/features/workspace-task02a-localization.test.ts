/**
 * Task 02A — Initiative create + Publishing editor form WEB_UI reconnect.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveActivityAreaDisplayLabel } from "./public-initiative-experience/initiative-experience-i18n.js";
import { resolveBlogCategoryDisplayName } from "./blog/resolve-blog-category-display-name.js";

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

describe("Task 02A — Initiative create + Publishing editor forms", () => {
  it("Initiative form: lifecycle codes → WEB_UI; activity resolver; no EN chrome", () => {
    const create = readWeb("features/initiatives/components/StartNewInitiativeButton.tsx");
    const fields = readWeb("features/initiatives/components/InitiativeFormFields.tsx");
    const news = readWeb("features/initiatives/components/InitiativeNewsSourcePanel.tsx");
    const overlap = readWeb(
      "features/community-intelligence/components/InitiativeOverlapNotice.tsx",
    );

    assert.match(create, /useTranslations\("initiativeExperience\.manage"\)/);
    assert.match(create, /lifecycleRoute\.standard\.title/);
    assert.match(create, /lifecycleRoute\.publicChoice\.title/);
    assert.match(create, /actions\.saveDraft/);
    assert.match(create, /actions\.publish/);
    assert.doesNotMatch(create, /Start New Initiative/);
    assert.doesNotMatch(create, /Lifecycle route/);
    assert.doesNotMatch(create, /"Save Draft"/);
    assert.doesNotMatch(create, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);

    assert.match(fields, /resolveActivityAreaDisplayLabel/);
    assert.match(news, /newsSource\.disclaimer/);
    assert.match(overlap, /initiativeExperience\.manage\.overlap/);

    const uk = messages("uk");
    const tManage = tFromCatalog(uk, "initiativeExperience.manage");
    const tExp = tFromCatalog(uk, "initiativeExperience");

    assert.equal(tManage("createHeading"), "Почати нову ініціативу");
    assert.equal(tManage("lifecycleRoute.standard.title"), "Стандартна ініціатива");
    assert.equal(tManage("lifecycleRoute.publicChoice.title"), "Громадський вибір");
    assert.equal(tManage("actions.saveDraft"), "Зберегти чернетку");
    assert.equal(tManage("fields.title"), "Назва");
    assert.notEqual(
      resolveActivityAreaDisplayLabel("Human Rights", tExp),
      "Human Rights",
    );

    // Participant-entered values must not be transformed by the create shell.
    assert.match(create, /value=\{title\}/);
    assert.match(create, /value=\{description\}/);
    assert.doesNotMatch(create, /translate\(title\)|provider|gemini/i);
  });

  it("Publishing editor: chrome + category resolver; participant fields untouched", () => {
    const editor = readWeb("features/blog/components/BlogPostEditor.tsx");
    const gate = readWeb("features/blog/components/BlogEditorPageContent.tsx");
    const shell = readWeb("features/blog/components/PublishingEditorWorkspacePage.tsx");
    const cover = readWeb("features/blog/components/BlogCoverField.tsx");
    const seo = readWeb("features/blog/components/BlogPublicationOptimizationPanel.tsx");

    assert.match(editor, /useTranslations\("workspace\.publishingPage"\)/);
    assert.match(editor, /editor\.chrome\.saveDraft/);
    assert.match(editor, /editor\.chrome\.publish/);
    assert.match(editor, /resolveBlogCategoryDisplayName/);
    assert.doesNotMatch(editor, /"Save Draft"/);
    assert.doesNotMatch(editor, /"Submit for Review"/);
    assert.doesNotMatch(editor, /Title must be at least/);

    assert.match(gate, /editor\.gate\.loading/);
    assert.match(shell, /editor\.page\.createTitle/);
    assert.match(cover, /editor\.media\.upload/);
    assert.match(seo, /editor\.seo\.heading/);

    const uk = messages("uk");
    const tPub = tFromCatalog(uk, "workspace.publishingPage");
    const tBlog = tFromCatalog(uk, "blogPublic");

    assert.equal(tPub("editor.chrome.saveDraft"), "Зберегти чернетку");
    assert.equal(tPub("editor.chrome.publish"), "Опублікувати");
    assert.equal(tPub("editor.page.createTitle"), "Нова публікація");
    assert.equal(
      resolveBlogCategoryDisplayName("conscious_existence", tBlog),
      tBlog("categories.conscious_existence.name"),
    );

    assert.match(editor, /value=\{title\}/);
    assert.match(editor, /value=\{excerpt\}/);
    assert.match(editor, /value=\{content\}/);
    assert.doesNotMatch(editor, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);
    assert.doesNotMatch(editor, /gemini|provider-on-read/i);
  });

  it("Architecture: catalog parity for new keys; no locale branching", () => {
    for (const locale of ["en", "uk", "ar", "zh-Hant"] as const) {
      const catalog = messages(locale);
      const manage = (catalog.initiativeExperience as { manage: Record<string, unknown> }).manage;
      assert.equal(typeof manage.createHeading, "string");
      assert.ok((manage.lifecycleRoute as { legend: string }).legend);
      const editor = (
        catalog.workspace as {
          publishingPage: {
            editor: {
              chrome: { saveDraft: string };
              reviewStatuses: { pending: string };
            };
          };
        }
      ).publishingPage.editor;
      assert.equal(typeof editor.chrome.saveDraft, "string");
      assert.equal(typeof editor.reviewStatuses.pending, "string");
    }

    const en = tFromCatalog(messages("en"), "workspace.publishingPage");
    const uk = tFromCatalog(messages("uk"), "workspace.publishingPage");
    assert.notEqual(uk("editor.chrome.saveDraft"), en("editor.chrome.saveDraft"));
    assert.notEqual(
      tFromCatalog(messages("uk"), "initiativeExperience.manage")("createHeading"),
      tFromCatalog(messages("en"), "initiativeExperience.manage")("createHeading"),
    );
  });
});

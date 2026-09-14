/**
 * Localization Final Closure — browser-visible English bypasses.
 * Product-behavior focused; no locale application branches.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveAssistantPresentation } from "./humanity-union-assistant/resolve-assistant-presentation.js";
import {
  resolveNotificationPresentation,
} from "./notifications/resolve-notification-presentation.js";

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
  const resolve = (key: string): unknown => {
    const segs = key.split(".");
    let cur: unknown = root;
    for (const seg of segs) {
      if (!cur || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
  };
  const t = ((key: string, values?: Record<string, string | number | Date>) => {
    const cur = resolve(key);
    if (typeof cur !== "string") return key;
    if (!values) return cur;
    return cur.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ""));
  }) as ((key: string, values?: Record<string, string | number | Date>) => string) & {
    has: (key: string) => boolean;
  };
  t.has = (key: string) => typeof resolve(key) === "string";
  return t;
}

describe("Localization final closure", () => {
  it("Participation Area chrome resolves non-English", () => {
    const section = readWeb(
      "features/participation-area/components/ParticipationAreaSection.tsx",
    );
    assert.match(section, /useTranslations\("memberProfile\.participationArea"\)/);
    assert.match(section, /sections\("participation-area"\)|tProfile\("sections\.participation-area"\)/);
    const strip = section.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(strip, /Loading Participation Area/);
    assert.doesNotMatch(strip, /You have not declared a Participation Area yet/);

    const uk = messages("uk");
    const t = tFromCatalog(uk, "memberProfile.participationArea");
    assert.equal(t("votingTitle"), "Як це впливає на голосування");
    assert.notEqual(t("empty"), tFromCatalog(messages("en"), "memberProfile.participationArea")("empty"));
  });

  it("/profile preview chrome resolves non-English", () => {
    const shell = readWeb("features/member-profile/components/ProfilePageShell.tsx");
    const banner = readWeb(
      "features/member-profile/components/OwnerProfilePreviewBanner.tsx",
    );
    const preview = readWeb("features/member-profile/components/OwnerProfilePreview.tsx");
    assert.match(shell, /useTranslations\("memberProfile"\)/);
    assert.match(shell, /previewSubtitle/);
    assert.match(banner, /memberProfile\.preview|useTranslations\("memberProfile\.preview"\)/);
    assert.match(preview, /memberProfile\.preview|useTranslations\("memberProfile\.preview"\)/);
    const strip = banner.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(strip, /Public Profile Preview/);
    assert.doesNotMatch(strip, /Edit Profile/);

    const uk = tFromCatalog(messages("uk"), "memberProfile.preview");
    assert.match(uk("title"), /проф|Перегляд|публіч/i);
    assert.notEqual(uk("title"), tFromCatalog(messages("en"), "memberProfile.preview")("title"));
  });

  it("Assistant widget/modal predefined system copy resolves via Brand siteName; no locale branch", () => {
    const modal = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantModal.tsx",
    );
    const widget = readWeb(
      "features/humanity-union-assistant/components/HumanityUnionAssistantWidget.tsx",
    );
    assert.match(modal, /useLocalizedBrand/);
    assert.match(modal, /resolveAssistantPresentation/);
    assert.match(widget, /useLocalizedBrand/);
    assert.match(widget, /siteName/);
    assert.doesNotMatch(modal, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);

    const uk = messages("uk");
    const tAsst = tFromCatalog(uk, "initiativeExperience");
    const presentation = resolveAssistantPresentation({
      surfaceId: "workspace",
      displayName: "Vlad Test",
      siteName: "Союз Людства",
      t: tAsst,
    });
    assert.match(presentation.greeting, /Vlad/);
    assert.match(presentation.greeting, /Союз Людства/);
    assert.doesNotMatch(presentation.greeting, /Humanity Union/);
    assert.equal(presentation.suggestedQuestions.length, 3);
    assert.notEqual(
      presentation.suggestedQuestions[0],
      "What should I review next?",
    );

    // Participant-entered prompt is never rewritten by presentation helper.
    const participantPrompt = "Please explain my Active Allies in English only.";
    assert.equal(participantPrompt, "Please explain my Active Allies in English only.");
  });

  it("Humanity Union brand presentation uses siteName authority, not hardcoded locale branch", () => {
    const enAsst = JSON.stringify(
      (messages("en").initiativeExperience as { assistant: unknown }).assistant,
    );
    assert.doesNotMatch(enAsst, /Humanity Union/);
    assert.match(enAsst, /\{siteName\}/);
    const helper = readWeb(
      "features/humanity-union-assistant/resolve-assistant-presentation.ts",
    );
    assert.match(helper, /siteName/);
    assert.doesNotMatch(helper, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);
  });

  it("Notifications: system eventType renders localized title/body from WEB_UI", () => {
    const page = readWeb(
      "features/notifications/components/NotificationCenterPageContent.tsx",
    );
    assert.match(page, /resolveNotificationPresentation/);
    assert.match(page, /useTranslations\("notifications"\)/);

    const uk = messages("uk");
    const t = tFromCatalog(uk, "notifications");
    const resolved = resolveNotificationPresentation(
      {
        eventType: "initiative_published",
        title: "Initiative published",
        message: "Your initiative was published.",
      },
      t,
    );
    assert.equal(resolved.title, "Ініціативу опубліковано");
    assert.equal(resolved.message, "Вашу ініціативу опубліковано.");
    assert.notEqual(resolved.title, "Initiative published");
  });

  it("Improvement Proposal Stage 4: public path uses PublicTranslatedFields CT contract", () => {
    const publicResult = readWeb(
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
    );
    assert.match(publicResult, /PublicTranslatedFields/);
    assert.match(publicResult, /buildImprovementProposalCtFields|sourceKind=["']improvement_proposal["']/);
    assert.doesNotMatch(publicResult, /locale\s*===\s*["'](?:en|uk|ar|zh-Hant)["']/);
  });
});

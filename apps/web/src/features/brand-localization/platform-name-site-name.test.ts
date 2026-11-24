/**
 * HU-LOC-BRAND-01B — platform-name sentences use {siteName}.
 * The legal name Humanity Union Society stays literal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createTranslator, type AbstractIntlMessages } from "next-intl";

import { getBuiltinEnglishBrand } from "./resolve-localized-brand";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const LOCALES = ["en", "ar", "de", "es", "fr", "he", "ka", "pt", "uk", "zh-Hant"] as const;

const LEGAL_KEYS = [
  "regionalProgramPublic.development.steps.team.body",
  "regionalProgramPublic.presence.notice",
  "regionalProgramPublic.principles.legal",
] as const;

const PLATFORM_KEYS = [
  "auth.loginSubtitle",
  "auth.deleteAccountIntro",
  "membershipPublic.faq.items.what-is-member.question",
  "volunteerPublic.intro.p1",
  "rrpApplication.consent.label",
] as const;

function read(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

function load(locale: string): Record<string, unknown> {
  return JSON.parse(read(`apps/web/src/features/i18n/messages/${locale}.json`)) as Record<
    string,
    unknown
  >;
}

function get(tree: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, tree);
}

function siteNameCount(value: string): number {
  return value.match(/\{siteName\}/g)?.length ?? 0;
}

describe("platform name uses published siteName", () => {
  it("replaces the platform name and keeps the surrounding sentence", () => {
    const english = load("en");
    assert.equal(get(english, "auth.loginSubtitle"), "Access your {siteName} workspace.");
    assert.equal(
      get(english, "auth.deleteAccountIntro"),
      "You can schedule deletion of your {siteName} account. The 30-day recovery period starts only after you confirm an email code.",
    );
    assert.match(String(get(english, "volunteerPublic.intro.p1")), /<platform>\{siteName\} platform<\/platform>/);
    assert.match(String(get(english, "rrpApplication.consent.label")), /\{siteName\}/);
    assert.match(String(get(english, "rrpApplication.consent.label")), /<privacy>/);

    for (const locale of LOCALES) {
      const catalog = load(locale);
      for (const key of PLATFORM_KEYS) {
        const value = get(catalog, key);
        if (typeof value !== "string") continue;
        assert.equal(siteNameCount(value), siteNameCount(String(get(english, key))), `${locale} ${key}`);
        const displayed = value.replaceAll("{siteName}", "Союз Людяності");
        assert.doesNotMatch(displayed, /\{siteName\}/, `${locale} ${key}`);
        assert.match(displayed, /Союз Людяності/);
      }
    }
  });

  it("keeps Humanity Union Society as the legal name", () => {
    for (const locale of LOCALES) {
      const catalog = load(locale);
      for (const key of LEGAL_KEYS) {
        const value = String(get(catalog, key));
        assert.match(value, /Humanity Union Society/, `${locale} ${key}`);
      }
    }
    const legal = String(get(load("en"), "regionalProgramPublic.principles.legal"));
    assert.match(legal, /\{siteName\}/);
    assert.match(legal, /Humanity Union Society/);
  });

  it("uses the builtin English siteName when Brand Localization is unavailable", () => {
    const fallback = getBuiltinEnglishBrand("ar");
    assert.equal(fallback.siteName, "Humanity Union");
    assert.equal(fallback.source, "builtin_english");
    const displayed = String(get(load("ar"), "auth.loginSubtitle")).replaceAll(
      "{siteName}",
      fallback.siteName,
    );
    assert.equal(displayed.includes("{siteName}"), false);
    assert.match(displayed, /Humanity Union/);
  });

  it("keeps Arabic and Hebrew RTL on the language registry, not in the catalog", () => {
    const layout = read("apps/web/src/app/layout.tsx");
    const catalog = read("apps/api/src/modules/language/language-catalog.ts");
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    assert.match(catalog, /code: "ar"[\s\S]{0,120}rtl: true/);
    assert.match(catalog, /code: "he"[\s\S]{0,120}rtl: true/);
    assert.doesNotMatch(read("apps/web/src/features/i18n/messages/ar.json"), /dir="ltr"/);
    assert.doesNotMatch(read("apps/web/src/features/i18n/messages/he.json"), /dir="ltr"/);
  });

  it("does not turn the glossary into a runtime replacement system", () => {
    const seed = read(
      "apps/api/src/modules/language/terminology-glossary/terminology-glossary.seed.ts",
    );
    assert.match(seed, /conceptId: "humanity_union"/);
    assert.match(seed, /canonicalEnglishTerm: "Humanity Union"/);
    assert.match(seed, /translations: \{\}/);
    const provider = read(
      "apps/api/src/modules/language/terminology-glossary/terminology-glossary.provider-context.ts",
    );
    assert.doesNotMatch(provider, /replaceAll\("Humanity Union"/);
  });

  it("protects approved published translations from Add missing overwrites", () => {
    const service = read(
      "apps/api/src/modules/web-ui-message-packs/web-ui-message-pack.service.ts",
    );
    assert.match(service, /Preserves every existing leaf/);
    assert.match(service, /preserveExistingPublishedLeaves: true/);
  });

  it("keeps the published nominative name grammatical", () => {
    const ka = load("ka");
    const georgian = [
      "civicActivity.pageSubtitle",
      "initiativeExperience.civicArchivePublic.pageTitle",
      "membershipPublic.faq.items.what-is-member.question",
      "initiativeExperience.manage.newsSource.disclaimer",
      "workspace.initiativesPage.subtitle",
      "pwa.install.installCta",
      "preferences.language.help",
    ];
    for (const key of georgian) {
      assert.doesNotMatch(String(get(ka, key)), /\{siteName\}[-\u10A0-\u10FF]/, key);
    }
    assert.equal(
      get(ka, "membershipPublic.faq.items.what-is-member.question"),
      "ვინ არის წევრი პლატფორმაზე {siteName}?",
    );
    assert.doesNotMatch(JSON.stringify(ka), /«\{siteName\}»/);
    assert.equal(get(ka, "pwa.install.installCta"), "დააინსტალირეთ {siteName}");

    const french = load("fr");
    assert.match(String(get(french, "auth.twoStepLoginHelp")), /à l''\{siteName\}/);
    assert.match(String(get(french, "authoringPage.application.motivationLabel")), /de l''\{siteName\}/);
    assert.match(String(get(french, "notifications.types.member_badge_delivered.message")), /Membre de l''\{siteName\}/);
    assert.doesNotMatch(JSON.stringify(french), /[^']'\{siteName\}/);
    assert.equal(get(french, "initiativeExperience.author.sidebar.assistantTitle"), "Assistant de l''{siteName}");
    assert.equal(
      get(french, "pwa.install.alreadyInstalled"),
      "L'application de l''{siteName} est déjà installée sur cet appareil.",
    );
    assert.equal(
      get(french, "pwa.install.lead"),
      "Emportez l'humanité avec vous. Installez l'application pour accéder directement à votre Espace de Travail, à vos Initiatives, à vos Notifications et à l'Assistant de l''{siteName}.",
    );
    assert.match(String(get(french, "auth.registerSubtitle")), /Participant de l''\{siteName\}/);
    assert.match(String(get(french, "memberProfile.subtitle")), /Participant de l''\{siteName\}/);
    assert.match(String(get(french, "memberProfile.membershipNote")), /adhésion/);
    assert.doesNotMatch(
      String(get(french, "notifications.types.member_badge_shipped.message")),
      /Participant|adhésion/,
    );
    assert.match(
      String(get(french, "rrpApplication.consent.label")),
      /l''\{siteName\}[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );
    assert.match(
      String(get(french, "volunteerPublic.intro.p1")),
      /<platform>plateforme de l''\{siteName\}<\/platform>/,
    );

    const spanish = load("es");
    assert.match(String(get(spanish, "auth.loginSubtitle")), /de la \{siteName\}/);
    assert.doesNotMatch(JSON.stringify(spanish), /la la \{siteName\}/);
    assert.equal(
      get(spanish, "membershipPublic.faq.items.what-is-member.question"),
      "¿Qué es un Miembro de la {siteName}?",
    );
    assert.equal(
      get(spanish, "initiativeExperience.author.sidebar.assistantTitle"),
      "Asistente de la {siteName}",
    );
    assert.doesNotMatch(JSON.stringify(spanish), /Assistant de \{siteName\}/);
    assert.equal(
      get(spanish, "pwa.install.alreadyInstalled"),
      "La aplicación de la {siteName} ya está instalada en este dispositivo.",
    );
    assert.match(
      String(get(spanish, "volunteerPublic.intro.p1")),
      /plataforma de la <platform>\{siteName\}<\/platform>/,
    );
    assert.match(
      String(get(spanish, "rrpApplication.consent.label")),
      /que la \{siteName\}[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );
    assert.match(String(get(spanish, "auth.registerSubtitle")), /Participante de la \{siteName\}/);
    assert.match(String(get(spanish, "memberProfile.subtitle")), /Participante de la \{siteName\}/);
    assert.match(String(get(spanish, "memberProfile.membershipNote")), /Membresía/);
    assert.match(
      String(get(spanish, "notifications.types.member_badge_shipped.message")),
      /artículo de Miembro de la \{siteName\}/,
    );
    assert.doesNotMatch(
      String(get(spanish, "notifications.types.member_badge_delivered.message")),
      /Participante|membresía/,
    );
    assert.equal(
      get(spanish, "workspace.publishingPage.editor.seo.huShareLegend"),
      "Distribución en canales sociales de la {siteName}",
    );

    const german = load("de");
    for (const key of [
      "auth.chooseNewPasswordSubtitle",
      "auth.verifyEmailSubtitle",
      "initiativeExperience.author.archive.document.disclaimer",
      "initiativeExperience.publicChoice.election.eyebrow",
      "initiativeExperience.publicChoice.results.disclaimerBody",
      "preferences.unavailableExplanation",
      "pwa.install.androidStep5",
      "workspace.publishingPage.editor.seo.lede",
      "volunteerPublic.meaning.p4",
      "volunteerPublic.takePart.p3",
    ]) {
      assert.doesNotMatch(String(get(german, key)), /\{siteName\}-/, key);
    }
    assert.match(String(get(german, "auth.chooseNewPasswordSubtitle")), /Konto bei \{siteName\}/);
    assert.match(String(get(german, "volunteerPublic.meaning.p4")), /<platform>Plattform \{siteName\}<\/platform>/);
    assert.equal(get(german, "auth.loginSubtitle"), "Greifen Sie auf Ihren Arbeitsbereich bei {siteName} zu.");
    assert.equal(
      get(german, "auth.registerSubtitle"),
      "Erstellen Sie Ihr Teilnehmerkonto bei {siteName}.",
    );
    assert.match(String(get(german, "auth.twoStepLoginHelp")), /Mitgliedschaft bei \{siteName\}/);
    assert.equal(get(german, "membershipPublic.faq.items.what-is-member.question"), "Was ist ein Mitglied von {siteName}?");
    assert.equal(get(german, "memberProfile.subtitle"), "Ihr Teilnehmerprofil bei {siteName}");
    assert.match(
      String(get(german, "notifications.types.member_badge_contribution_confirmed.message")),
      /Mitgliedsartikel von \{siteName\}/,
    );
    assert.doesNotMatch(
      String(get(german, "notifications.types.member_badge_delivered.message")),
      /Teilnehmer|Mitgliedschaft/,
    );
    assert.equal(get(german, "pwa.install.lead"), "Nehmen Sie die Menschlichkeit mit. Installieren Sie die App für den direkten Zugriff auf Ihren Arbeitsbereich, Ihre Initiativen, Benachrichtigungen und den Assistenten von {siteName}.");
    assert.doesNotMatch(String(get(german, "pwa.install.lead")), /Humanity/);
    assert.equal(get(german, "workspace.publishingPage.editor.seo.huShareLegend"), "Social-Media-Verbreitung von {siteName}");
    assert.match(String(get(german, "rrpApplication.consent.label")), /<privacy>[\s\S]*<\/privacy>/);
    assert.doesNotMatch(JSON.stringify(german), /«\{siteName\}»/);

    assert.match(String(get(load("ar"), "membershipPublic.faq.items.what-is-member.question")), /في \{siteName\}/);
    const ukrainian = load("uk");
    assert.equal(
      get(ukrainian, "membershipPublic.faq.items.what-is-member.question"),
      "Хто такий Член платформи {siteName}?",
    );
    assert.equal(
      get(ukrainian, "pwa.install.lead"),
      "Візьміть Людяність із собою. Встановіть додаток для прямого доступу до вашого Робочого простору, Ініціатив, сповіщень та Помічника платформи {siteName}.",
    );
    assert.doesNotMatch(String(get(ukrainian, "pwa.install.lead")), /Humanity/);
    for (const key of [
      "notifications.types.member_badge_contribution_confirmed.message",
      "notifications.types.member_badge_delivered.message",
      "notifications.types.member_badge_shipped.message",
    ]) {
      assert.match(String(get(ukrainian, key)), /Члена платформи \{siteName\}/, key);
      assert.doesNotMatch(String(get(ukrainian, key)), /Учасник/, key);
    }
    assert.match(String(get(ukrainian, "auth.registerSubtitle")), /Учасника платформи \{siteName\}/);
    assert.match(
      String(get(ukrainian, "rrpApplication.consent.label")),
      /платформа \{siteName\} обробляла[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );
    assert.match(
      String(get(ukrainian, "initiativeExperience.manage.newsSource.disclaimer")),
      /Платформа \{siteName\} не перевіряла/,
    );
    assert.match(
      String(get(ukrainian, "authoringPage.becomeAuthor.thanks")),
      /долучення до Блогу платформи \{siteName\}/,
    );
    assert.equal(
      get(load("zh-Hant"), "membershipPublic.faq.items.what-is-member.question"),
      "什麼是{siteName}的成員？",
    );
    assert.match(String(get(load("pt"), "auth.loginSubtitle")), /da \{siteName\}/);
    const hebrew = load("he");
    assert.match(String(get(hebrew, "auth.loginSubtitle")), /ב\{siteName\}/);
    assert.equal(
      get(hebrew, "initiativeExperience.author.petition.public.participationTransparencyNote"),
      "חתימה על עצומה זו היא צורה של השתתפות אזרחית ב{siteName}. אין זו עצומה מחייבת מבחינה משפטית, והיא אינה יוצרת, כשלעצמה, כל חובה משפטית או ממשלתית.",
    );
    assert.doesNotMatch(
      String(get(hebrew, "initiativeExperience.author.petition.public.participationTransparencyNote")),
      /משתתף/,
    );
    assert.match(String(get(hebrew, "auth.registerSubtitle")), /מִשׁתַתֵף/);
    assert.match(String(get(hebrew, "memberProfile.subtitle")), /המִשׁתַתֵף שלך ב\{siteName\}/);
    assert.equal(get(hebrew, "membershipPublic.faq.items.what-is-member.question"), "מהו חָבֵר של {siteName}?");
    assert.match(String(get(hebrew, "memberProfile.membershipNote")), /חֲבֵרוּת/);
    assert.match(
      String(get(hebrew, "notifications.types.member_badge_shipped.message")),
      /פריט החָבֵר הרשמי של \{siteName\} יצא למשלוח/,
    );
    assert.doesNotMatch(
      String(get(hebrew, "notifications.types.member_badge_delivered.message")),
      /משתתף|חֲבֵרוּת/,
    );
    assert.match(String(get(hebrew, "pwa.install.lead")), /האנושות/);
    assert.doesNotMatch(String(get(hebrew, "pwa.install.lead")), /Humanity/);
    assert.match(
      String(get(hebrew, "rrpApplication.consent.label")),
      /\{siteName\}[\s\S]*<privacy>[\s\S]*<\/privacy>/,
    );

    const corrected = {
      ka: georgian,
      fr: [
        "auth.twoStepLoginHelp",
        "auth.loginSubtitle",
        "auth.registerSubtitle",
        "authoringPage.application.motivationLabel",
        "initiativeExperience.author.sidebar.assistantTitle",
        "pwa.install.alreadyInstalled",
        "pwa.install.lead",
        "rrpApplication.consent.label",
        "volunteerPublic.intro.p1",
        "notifications.types.member_badge_delivered.message",
        "workspace.publishingPage.editor.seo.huShareLegend",
      ],
      es: [
        "auth.loginSubtitle",
        "auth.deleteAccountIntro",
        "auth.registerSubtitle",
        "membershipPublic.faq.items.what-is-member.question",
        "initiativeExperience.author.sidebar.assistantTitle",
        "pwa.install.alreadyInstalled",
        "pwa.install.lead",
        "volunteerPublic.intro.p1",
        "rrpApplication.consent.label",
        "notifications.types.member_badge_shipped.message",
        "workspace.publishingPage.editor.seo.huShareLegend",
        "preferences.subtitle",
        "authoringPage.application.motivationLabel",
      ],
      he: [
        "auth.loginSubtitle",
        "auth.twoStepLoginHelp",
        "initiativeExperience.author.petition.public.participationTransparencyNote",
        "memberProfile.subtitle",
        "membershipPublic.faq.items.what-is-member.question",
        "notifications.types.member_badge_shipped.message",
        "pwa.install.lead",
        "pwa.install.alreadyInstalled",
        "rrpApplication.consent.label",
        "volunteerPublic.intro.p1",
      ],
      de: ["auth.chooseNewPasswordSubtitle", "volunteerPublic.meaning.p4"],
      ar: ["membershipPublic.faq.items.what-is-member.question"],
      uk: ["membershipPublic.faq.items.what-is-member.question"],
      "zh-Hant": ["membershipPublic.faq.items.what-is-member.question"],
    };
    for (const [locale, keys] of Object.entries(corrected)) {
      const packaged = JSON.parse(
        read(`apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
      ) as Record<string, unknown>;
      for (const key of keys) {
        assert.equal(get(packaged, key), get(load(locale), key), `${locale} ${key}`);
      }
    }
  });

  it("renders French elision as one apostrophe and the interpolated brand", () => {
    const french = load("fr");
    const t = createTranslator({
      locale: "fr",
      messages: french as AbstractIntlMessages,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const siteName = "Union de l'Humanité";
    const rich = (chunks: string) => chunks;
    for (const key of [
      "auth.loginSubtitle",
      "auth.registerSubtitle",
      "initiativeExperience.author.sidebar.assistantTitle",
      "pwa.install.alreadyInstalled",
      "pwa.install.lead",
      "membershipPublic.faq.items.what-is-member.question",
    ]) {
      const rendered = t(key, { siteName });
      assert.equal(typeof rendered, "string", key);
      assert.doesNotMatch(rendered, /\{siteName\}|''/, key);
      assert.match(rendered, /l'Union de l'Humanité/, key);
    }
    const lead = t("pwa.install.lead", { siteName });
    assert.match(lead, /l'humanité/);
    assert.doesNotMatch(lead, /Humanity/);
    const consent = t("rrpApplication.consent.label", { siteName, privacy: rich });
    assert.match(consent, /l'Union de l'Humanité/);
    assert.match(consent, /Politique de confidentialité/);
    assert.doesNotMatch(consent, /\{siteName\}|<privacy>|''/);
    const platform = t("volunteerPublic.intro.p1", { siteName, platform: rich });
    assert.equal(platform, "Le développement de la plateforme de l'Union de l'Humanité est une contribution personnelle que chacun d'entre nous peut apporter à son propre avenir et à celui des générations futures.");
    const fallback = t("auth.loginSubtitle", { siteName: "Humanity Union" });
    assert.equal(fallback, "Accédez à votre Espace de Travail de l'Humanity Union.");
    assert.doesNotMatch(fallback, /\{siteName\}|''/);
    assert.match(t("auth.registerSubtitle", { siteName }), /Participant/);
    assert.match(t("membershipPublic.faq.items.what-is-member.question", { siteName }), /Membre/);
    assert.doesNotMatch(
      t("notifications.types.member_badge_shipped.message", { siteName }),
      /Participant/,
    );
  });

  it("renders Hebrew brand prefixes without unresolved placeholders", () => {
    const hebrew = load("he");
    const t = createTranslator({
      locale: "he",
      messages: hebrew as AbstractIntlMessages,
    }) as unknown as (key: string, values?: Record<string, unknown>) => string;
    const siteName = "איחוד האנושות";
    const rich = (chunks: string) => chunks;
    const login = t("auth.loginSubtitle", { siteName });
    assert.equal(login, "גש אל סביבת העבודה שלך באיחוד האנושות.");
    assert.doesNotMatch(login, /\{siteName\}|ב-|ב /);
    const petition = t("initiativeExperience.author.petition.public.participationTransparencyNote", { siteName });
    assert.match(petition, /עצומה זו/);
    assert.doesNotMatch(petition, /משתתף|\{siteName\}/);
    const lead = t("pwa.install.lead", { siteName });
    assert.match(lead, /האנושות/);
    assert.match(lead, /ולעוזר של איחוד האנושות/);
    assert.doesNotMatch(lead, /Humanity|\{siteName\}/);
    const consent = t("rrpApplication.consent.label", { siteName, privacy: rich });
    assert.match(consent, /איחוד האנושות/);
    assert.match(consent, /מדיניות הפרטיות/);
    assert.doesNotMatch(consent, /\{siteName\}|<privacy>/);
    const platform = t("volunteerPublic.intro.p1", { siteName, platform: rich });
    assert.equal(
      platform,
      "פיתוח פלטפורמת איחוד האנושות הוא תרומה אישית שכל אחד מאיתנו יכול לתת לעתיד שלנו ולעתיד הדורות הבאים.",
    );
    const fallback = t("auth.loginSubtitle", { siteName: "Humanity Union" });
    assert.equal(fallback, "גש אל סביבת העבודה שלך בHumanity Union.");
    assert.doesNotMatch(fallback, /\{siteName\}/);
    for (const key of [
      "auth.loginSubtitle",
      "initiativeExperience.author.petition.public.participationTransparencyNote",
      "pwa.install.lead",
      "rrpApplication.consent.label",
      "notifications.types.member_badge_shipped.message",
    ]) {
      assert.doesNotMatch(String(get(hebrew, key)), /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/, key);
    }
  });

  it("packages the same corrected deletion intro as the WEB catalog", () => {
    for (const locale of LOCALES) {
      const web = get(load(locale), "auth.deleteAccountIntro");
      const packaged = JSON.parse(
        read(`apps/api/assets/packaged-web-ui-catalogs/${locale}.json`),
      ) as Record<string, unknown>;
      assert.equal(get(packaged, "auth.deleteAccountIntro"), web, locale);
    }
  });
});

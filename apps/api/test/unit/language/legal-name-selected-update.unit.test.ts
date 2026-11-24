/**
 * HU-LOC-BRAND-02D.2 — legal-name occurrences follow canonical English.
 * Planner only. No catalog writes and no production Apply.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { WebUiMessageTree } from "@hu/types";

import {
  planSelectedPackagedWebUiUpdates,
  type PlannedSelectedPackagedUpdate,
} from "../../../src/modules/web-ui-message-packs/plan-selected-packaged-web-ui-updates.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const messagesDir = path.resolve(here, "../../../../web/src/features/i18n/messages");
const LEGAL_NAME = "Humanity Union Society";
const LEGAL_KEY = "regionalProgramPublic.principles.legal";
const LOGIN_KEY = "auth.loginSubtitle";
const RICH_KEY = "volunteerPublic.intro.p1";
const LEGAL_ERROR = "Humanity Union Society cannot be changed.";

const LOCALES = ["de", "uk", "es", "fr", "he", "ka", "pt", "ar", "zh-Hant"] as const;

function readCatalog(locale: string): WebUiMessageTree {
  return JSON.parse(readFileSync(path.join(messagesDir, `${locale}.json`), "utf8")) as WebUiMessageTree;
}

function readLeaf(tree: WebUiMessageTree, dotted: string): string {
  let current: unknown = tree;
  for (const segment of dotted.split(".")) {
    assert.ok(current && typeof current === "object");
    current = (current as Record<string, unknown>)[segment];
  }
  assert.equal(typeof current, "string", dotted);
  return current as string;
}

function nest(dotted: string, value: string): WebUiMessageTree {
  const parts = dotted.split(".");
  const root: Record<string, unknown> = {};
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const next: Record<string, unknown> = {};
    cursor[parts[index] ?? ""] = next;
    cursor = next;
  }
  cursor[parts[parts.length - 1] ?? ""] = value;
  return root as WebUiMessageTree;
}

function planValues(
  key: string,
  existingValue: string,
  proposedValue: string,
  withReplacement = false,
): PlannedSelectedPackagedUpdate {
  const published = nest(key, existingValue);
  const packaged = nest(key, proposedValue);
  return planSelectedPackagedWebUiUpdates({
    paths: [key],
    published,
    packaged,
    replacements: withReplacement
      ? [{ path: key, existingValue, proposedValue }]
      : undefined,
  });
}

function errorsOf(result: PlannedSelectedPackagedUpdate): readonly string[] {
  return result.entries[0]?.errors ?? [];
}

const german = readLeaf(readCatalog("de"), LEGAL_KEY);
const englishLegal = readLeaf(readCatalog("en"), LEGAL_KEY);
const englishLogin = readLeaf(readCatalog("en"), LOGIN_KEY);
const englishRich = readLeaf(readCatalog("en"), RICH_KEY);

describe("selected translation legal-name protection", () => {
  it("01 identical legal-name values are unchanged", () => {
    const result = planValues(LEGAL_KEY, german, german);
    assert.deepEqual(errorsOf(result), ["Selected value is unchanged."]);
    assert.equal(errorsOf(result).includes(LEGAL_ERROR), false);
    assert.equal(result.messages, null);
  });

  it("02 allows surrounding grammar changes that keep the legal name", () => {
    const proposed = german.replace("gegründet wurde", "gegründet worden ist");
    assert.notEqual(proposed, german);
    const result = planValues(LEGAL_KEY, german, proposed);
    assert.deepEqual(errorsOf(result), []);
    assert.ok(result.messages);
  });

  it("03 allows a grammar change that keeps the legal name and {siteName}", () => {
    const proposed = german.replace("rechtliche Grundlage", "rechtliche Basis");
    assert.match(proposed, /Humanity Union Society/);
    assert.match(proposed, /\{siteName\}/);
    const result = planValues(LEGAL_KEY, german, proposed);
    assert.deepEqual(errorsOf(result), []);
    assert.ok(result.messages);
  });

  it("04 rejects removal of the legal name", () => {
    const proposed = german.replace(LEGAL_NAME, "die Organisation");
    const result = planValues(LEGAL_KEY, german, proposed);
    assert.ok(errorsOf(result).includes(LEGAL_ERROR));
    assert.equal(result.messages, null);
  });

  it("05 rejects a translated legal name", () => {
    const proposed = german.replace(LEGAL_NAME, "Gesellschaft der Menschlichkeit");
    const result = planValues(LEGAL_KEY, german, proposed);
    assert.ok(errorsOf(result).includes(LEGAL_ERROR));
    assert.equal(result.messages, null);
  });

  it("06 rejects a renamed legal name", () => {
    const proposed = german.replace(LEGAL_NAME, "Humanity Union Association");
    const result = planValues(LEGAL_KEY, german, proposed);
    assert.ok(errorsOf(result).includes(LEGAL_ERROR));
    assert.equal(result.messages, null);
  });

  it("07 rejects a duplicated legal name", () => {
    const proposed = `${german} ${LEGAL_NAME}`;
    const result = planValues(LEGAL_KEY, german, proposed);
    assert.ok(errorsOf(result).includes(LEGAL_ERROR));
    assert.equal(result.messages, null);
  });

  it("08 rejects glued or extended names and allows punctuation and multilingual boundaries", () => {
    const invalid = [
      german.replace(LEGAL_NAME, `${LEGAL_NAME}Extra`),
      german.replace(LEGAL_NAME, `X${LEGAL_NAME}`),
      german.replace(LEGAL_NAME, `${LEGAL_NAME}\u0435`),
      german.replace(LEGAL_NAME, `${LEGAL_NAME}\u05D0`),
      german.replace(LEGAL_NAME, `${LEGAL_NAME}\u4E2D`),
      german.replace(LEGAL_NAME, `${LEGAL_NAME}_`),
      german.replace(LEGAL_NAME, `${LEGAL_NAME}\u200DExtra`),
    ];
    for (const proposed of invalid) {
      const result = planValues(LEGAL_KEY, german, proposed);
      assert.ok(errorsOf(result).includes(LEGAL_ERROR), proposed);
      assert.equal(result.messages, null);
    }

    const valid = [
      `${LEGAL_NAME}. Die {siteName}-Plattform bleibt bestehen.`,
      `«${LEGAL_NAME}» trägt die {siteName}-Plattform.`,
      `(${LEGAL_NAME}) trägt die {siteName}-Plattform.`,
      `${LEGAL_NAME}-Plattform {siteName} bleibt geschützt.`,
      `הוא ${LEGAL_NAME} בפלטפורמה {siteName}.`,
      `هذه ${LEGAL_NAME} لمنصة {siteName}.`,
      `「${LEGAL_NAME}」是 {siteName} 的法律基礎。`,
    ];
    for (const proposed of valid) {
      const result = planValues(LEGAL_KEY, german, proposed);
      assert.deepEqual(errorsOf(result), [], proposed);
      assert.ok(result.messages);
    }
  });

  it("09 rejects a missing {siteName} through placeholder validation", () => {
    const proposed = german.replaceAll("{siteName}", "der Plattform");
    const result = planValues(LEGAL_KEY, german, proposed);
    assert.equal(errorsOf(result).includes(LEGAL_ERROR), false);
    assert.match(errorsOf(result).join(" "), /Invalid placeholder set/);
    assert.equal(result.messages, null);
  });

  it("10 rejects a corrupted rich tag while the legal name stays absent", () => {
    const proposed = englishRich.replaceAll("<platform>", "").replaceAll("</platform>", "");
    assert.equal(proposed.includes(LEGAL_NAME), false);
    const result = planValues(RICH_KEY, englishRich, proposed);
    assert.equal(errorsOf(result).includes(LEGAL_ERROR), false);
    assert.match(errorsOf(result).join(" "), /<platform>/);
    assert.equal(result.messages, null);
  });

  it("11 rejects an omitted legal name even when existing and proposed match", () => {
    const omitted = "Die Organisation trägt die {siteName}-Plattform.";
    const result = planValues(LEGAL_KEY, omitted, omitted);
    assert.ok(errorsOf(result).includes(LEGAL_ERROR));
    assert.equal(errorsOf(result).includes("Selected value is unchanged."), false);
    assert.equal(result.messages, null);
  });

  it("12 allows an explicit restoration of the canonical legal name", () => {
    const omitted = "Die Organisation trägt die {siteName}-Plattform.";
    const result = planValues(LEGAL_KEY, omitted, german);
    assert.deepEqual(errorsOf(result), []);
    assert.ok(result.messages);
    assert.match(englishLegal, /Humanity Union Society/);
  });

  it("13 rejects an unauthorized legal name on an ordinary key", () => {
    const proposed = englishLogin.replace("{siteName}", `${LEGAL_NAME} {siteName}`);
    const result = planValues(LOGIN_KEY, englishLogin, proposed);
    assert.ok(errorsOf(result).includes(LEGAL_ERROR));
    assert.equal(result.messages, null);
  });

  it("14 keeps ordinary selected updates unchanged", () => {
    const proposed = "Reach your {siteName} workspace.";
    const changed = planValues(LOGIN_KEY, englishLogin, proposed);
    assert.deepEqual(errorsOf(changed), []);
    assert.ok(changed.messages);
    const same = planValues(LOGIN_KEY, englishLogin, englishLogin);
    assert.deepEqual(errorsOf(same), ["Selected value is unchanged."]);
  });

  it("15 rejects an unknown key path", () => {
    const result = planValues("not.a.real.key", "old", "new");
    assert.ok(errorsOf(result).includes("Unknown key path."));
    assert.equal(result.messages, null);
  });

  it("16 produces no publication plan when one selected key mutates the legal name", () => {
    const published = {
      auth: { loginSubtitle: englishLogin },
      regionalProgramPublic: { principles: { legal: german } },
    } as WebUiMessageTree;
    const packaged = {
      auth: { loginSubtitle: "Reach your {siteName} workspace." },
      regionalProgramPublic: {
        principles: { legal: german.replace(LEGAL_NAME, "die Organisation") },
      },
    } as WebUiMessageTree;
    const result = planSelectedPackagedWebUiUpdates({
      paths: [LOGIN_KEY, LEGAL_KEY],
      published,
      packaged,
    });
    assert.equal(result.messages, null);
    assert.deepEqual(
      result.entries.find((entry) => entry.path === LOGIN_KEY)?.errors,
      [],
    );
    assert.ok(result.entries.find((entry) => entry.path === LEGAL_KEY)?.errors.includes(LEGAL_ERROR));
  });

  it("17 uses the same protection contract for preview and apply planning", () => {
    const cases = [
      [german, german],
      [german, german.replace(LEGAL_NAME, "die Organisation")],
      ["Die Organisation trägt die {siteName}-Plattform.", german],
    ] as const;
    for (const [existingValue, proposedValue] of cases) {
      const preview = planValues(LEGAL_KEY, existingValue, proposedValue, false);
      const apply = planValues(LEGAL_KEY, existingValue, proposedValue, true);
      assert.deepEqual(errorsOf(preview), errorsOf(apply));
      assert.equal(preview.messages == null, apply.messages == null);
    }
  });

  it("allows grammar-only updates and rejects mutations across published locales", () => {
    for (const locale of LOCALES) {
      const value = readLeaf(readCatalog(locale), LEGAL_KEY);
      assert.match(value, /Humanity Union Society/, locale);
      assert.match(value, /\{siteName\}/, locale);
      const identical = planValues(LEGAL_KEY, value, value);
      assert.deepEqual(errorsOf(identical), ["Selected value is unchanged."], locale);
      const grammar = planValues(LEGAL_KEY, value, `${value}\u00b7`);
      assert.deepEqual(errorsOf(grammar), [], locale);
      assert.ok(grammar.messages, locale);
      const mutated = planValues(LEGAL_KEY, value, value.replace(LEGAL_NAME, "Translated Name"));
      assert.ok(errorsOf(mutated).includes(LEGAL_ERROR), locale);
      assert.equal(mutated.messages, null, locale);
    }
  });

  it("does not depend on a language allowlist for a future locale", () => {
    const proposed = `Vel qir ${LEGAL_NAME} na {siteName} tor.`;
    const allowed = planValues(LEGAL_KEY, german, proposed);
    assert.deepEqual(errorsOf(allowed), []);
    assert.ok(allowed.messages);
    const glued = planValues(LEGAL_KEY, german, `Vel qir ${LEGAL_NAME}\u10D0 na {siteName} tor.`);
    assert.ok(errorsOf(glued).includes(LEGAL_ERROR));
    assert.equal(glued.messages, null);
  });

  it("reproduces the German production no-op and a grammar-only correction", () => {
    const identical = planValues(LEGAL_KEY, german, german);
    assert.deepEqual(errorsOf(identical), ["Selected value is unchanged."]);
    assert.equal(errorsOf(identical).includes(LEGAL_ERROR), false);
    const corrected = german.replace("gegründet wurde", "gegründet worden ist");
    const grammar = planValues(LEGAL_KEY, german, corrected);
    assert.deepEqual(errorsOf(grammar), []);
    assert.ok(grammar.messages);
    assert.match(String(readLeaf(grammar.messages as WebUiMessageTree, LEGAL_KEY)), /Humanity Union Society/);
    assert.match(String(readLeaf(grammar.messages as WebUiMessageTree, LEGAL_KEY)), /\{siteName\}/);
  });
});

/**
 * Pack 02G Task 08E.9b — API semantic consistency/conflict presentation + skew.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { resolveInitiativeExperienceMessage } from "../public-initiative-experience/initiative-experience-i18n.js";
import {
  resolveApiConflictWarningDisplay,
  resolveApiConsistencyCheckDisplay,
  resolveApiConsistencyLabelDisplay,
  resolveRevisionConflictSectionLabel,
} from "../initiative-lifecycle-stage-workspace/resolve-api-consistency-display.js";

function ieKey(messages: Record<string, unknown>, key: string): string {
  const value = resolveInitiativeExperienceMessage(messages, key);
  assert.ok(value, `missing initiativeExperience.${key}`);
  return value;
}

function formatMessage(
  template: string,
  values: Record<string, string | number | Date> = {},
): string {
  let text = template;
  // Allow nested `{placeholder}` inside plural branches (one level).
  const pluralRe =
    /\{(\w+),\s*plural,\s*((?:[a-z0-9=]+\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*)+)\}/;
  while (pluralRe.test(text)) {
    text = text.replace(pluralRe, (_full, name: string, body: string) => {
      const count = Number(values[name] ?? 0);
      const branches = new Map<string, string>();
      for (const match of body.matchAll(/([a-z0-9=]+)\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g)) {
        branches.set(match[1]!, match[2]!);
      }
      const picked =
        count === 1 && branches.has("one")
          ? branches.get("one")!
          : (branches.get("other") ?? branches.get("many") ?? branches.get("few") ?? "");
      return picked.replace(/#/g, String(count));
    });
  }
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

function translatorFor(messages: Record<string, unknown>) {
  return (key: string, values?: Record<string, string | number | Date>) =>
    formatMessage(ieKey(messages, key), values);
}

describe("08E.9b apiConsistency catalogs", () => {
  it("en/uk/zh-Hant/ar apiConsistency leaf keys exist", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(
        typeof ieKey(loaded.messages, "author.sidebar.apiConsistency.generic.warning"),
        "string",
      );
      assert.equal(
        typeof ieKey(
          loaded.messages,
          "author.sidebar.apiConsistency.revision.multiple_changes_same_section",
        ),
        "string",
      );
      assert.equal(
        typeof ieKey(
          loaded.messages,
          "author.sidebar.apiConsistency.petition.revision-available.warning",
        ),
        "string",
      );
      assert.equal(
        typeof ieKey(
          loaded.messages,
          "author.sidebar.apiConsistency.civicArchive.optional-stages-missing.warning",
        ),
        "string",
      );
    }
  });

  it("uk/zh-Hant/ar apiConsistency keys are not English copies for conflict + petition warning", async () => {
    const en = await loadUiMessagesForLocale("en");
    const enConflict = ieKey(
      en.messages,
      "author.sidebar.apiConsistency.revision.multiple_changes_same_section",
    );
    const enPetition = ieKey(
      en.messages,
      "author.sidebar.apiConsistency.petition.revision-available.warning",
    );
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.notEqual(
        ieKey(loaded.messages, "author.sidebar.apiConsistency.revision.multiple_changes_same_section"),
        enConflict,
      );
      assert.notEqual(
        ieKey(loaded.messages, "author.sidebar.apiConsistency.petition.revision-available.warning"),
        enPetition,
      );
    }
  });

  it("bundled verification catalog parity still passes", async () => {
    const result = await verifyBundledVerificationCatalogParity();
    assert.equal(result.ok, true, JSON.stringify(result.reports, null, 2));
  });
});

describe("08E.9b resolveApiConflictWarningDisplay", () => {
  it("prefers semantic code + section + params", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConflictWarningDisplay(
      {
        code: "multiple_changes_same_section",
        section: "description",
        sectionLabel: "Description",
        changeIds: ["c1", "c2"],
        proposalIds: ["p1"],
        params: { changeCount: 2 },
        message: "LEGACY SHOULD NOT WIN",
      },
      t,
    );
    assert.equal(presentation.mode, "semantic");
    assert.match(presentation.text, /2 changes target the Description section/);
    assert.equal(presentation.sectionLabel, "Description");
    assert.doesNotMatch(presentation.text, /LEGACY/);
  });

  it("falls back to legacy message when semantic fields absent", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConflictWarningDisplay(
      {
        section: "title",
        message: "legacy conflict message only",
      },
      t,
    );
    assert.equal(presentation.mode, "legacy");
    assert.equal(presentation.text, "legacy conflict message only");
  });

  it("unknown-code without message uses generic conflict fallback", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConflictWarningDisplay(
      {
        section: "custom",
        code: "not_a_real_code" as "multiple_changes_same_section",
        params: { changeCount: 3 },
      },
      t,
    );
    assert.equal(presentation.mode, "generic");
    assert.equal(
      presentation.text,
      ieKey(loaded.messages, "author.sidebar.apiConsistency.generic.conflict"),
    );
  });

  it("localizes section from canonical id without API sectionLabel", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    assert.equal(resolveRevisionConflictSectionLabel("title", t), "Title");
    assert.equal(resolveRevisionConflictSectionLabel("custom", t), "Custom");
  });
});

describe("08E.9b resolveApiConsistencyCheckDisplay", () => {
  it("petition semantic warning uses checkId + status + civic", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConsistencyCheckDisplay(
      "petition",
      {
        checkId: "analysis-available",
        status: "ok",
        detail: "LEGACY",
        params: {},
        civic: { title: "Water analysis" },
      },
      t,
    );
    assert.equal(presentation.mode, "semantic");
    assert.match(presentation.text, /Water analysis/);
    assert.doesNotMatch(presentation.text, /LEGACY/);
  });

  it("legacy detail-only payload uses raw detail", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConsistencyCheckDisplay(
      "petition",
      {
        checkId: "analysis-available",
        status: "warning",
        detail: "Opaque legacy detail only.",
      },
      t,
    );
    assert.equal(presentation.mode, "legacy");
    assert.equal(presentation.text, "Opaque legacy detail only.");
  });

  it("unknown checkId with detail → raw detail", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConsistencyCheckDisplay(
      "petition",
      {
        checkId: "not-a-real-check",
        status: "warning",
        detail: "Unknown but detailed.",
        params: {},
      },
      t,
    );
    assert.equal(presentation.mode, "legacy");
    assert.equal(presentation.text, "Unknown but detailed.");
  });

  it("unknown checkId without detail → generic warning", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConsistencyCheckDisplay(
      "petition",
      {
        checkId: "not-a-real-check",
        status: "warning",
        params: {},
      },
      t,
    );
    assert.equal(presentation.mode, "generic");
    assert.equal(
      presentation.text,
      ieKey(loaded.messages, "author.sidebar.apiConsistency.generic.warning"),
    );
  });

  it("archive optional-stages-missing presents localized stage ids", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConsistencyCheckDisplay(
      "civicArchive",
      {
        checkId: "optional-stages-missing",
        status: "warning",
        detail: "LEGACY",
        params: { stageIds: ["proposal", "petition"] },
      },
      t,
    );
    assert.equal(presentation.mode, "semantic");
    assert.match(presentation.text, /proposal|Proposal|提案|Пропози/i);
    assert.match(presentation.text, /petition|Petition|請願|Петиц/i);
  });

  it("resolves localized labels for snapshot panels", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const label = resolveApiConsistencyLabelDisplay(
      "petition",
      {
        checkId: "revision-available",
        status: "warning",
        label: "English Label",
        params: {},
      },
      t,
    );
    assert.equal(label, "Published Revision");
  });

  it("uk petition warning is not English", async () => {
    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    const enText = resolveApiConsistencyCheckDisplay(
      "petition",
      {
        checkId: "revision-available",
        status: "warning",
        params: {},
      },
      translatorFor(en.messages),
    ).text;
    const ukText = resolveApiConsistencyCheckDisplay(
      "petition",
      {
        checkId: "revision-available",
        status: "warning",
        params: {},
      },
      translatorFor(uk.messages),
    ).text;
    assert.notEqual(ukText, enText);
  });
});

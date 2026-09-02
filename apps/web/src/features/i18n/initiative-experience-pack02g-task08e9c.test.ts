/**
 * Pack 02G Task 08E.9c — Revision consistency + DS sink retirement + skew.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyBundledVerificationCatalogParity } from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { resolveInitiativeExperienceMessage } from "../public-initiative-experience/initiative-experience-i18n.js";
import {
  resolveApiConflictWarningDisplay,
  resolveApiConsistencyCheckDisplay,
  resolveApiConsistencyLabelDisplay,
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

describe("08E.9c revision consistency catalogs", () => {
  it("revision consistency keys exist in all locales", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      assert.equal(
        typeof ieKey(
          loaded.messages,
          "author.sidebar.apiConsistency.revision.accepted-proposals-traced.warning",
        ),
        "string",
      );
      assert.equal(
        typeof ieKey(
          loaded.messages,
          "author.sidebar.apiConsistency.revision.changes-have-origin.ok",
        ),
        "string",
      );
      assert.equal(
        typeof ieKey(
          loaded.messages,
          "author.sidebar.apiConsistency.revision.labels.accepted-proposals-traced",
        ),
        "string",
      );
    }
  });

  it("bundled verification catalog parity still passes", async () => {
    const result = await verifyBundledVerificationCatalogParity();
    assert.equal(result.ok, true, JSON.stringify(result.reports, null, 2));
  });
});

describe("08E.9c revision consistency presentation", () => {
  it("presents warning/ok from semantic params without legacy prose", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const warning = resolveApiConsistencyCheckDisplay(
      "revision",
      {
        checkId: "accepted-proposals-traced",
        status: "warning",
        params: { count: 2 },
      },
      t,
    );
    assert.equal(warning.mode, "semantic");
    assert.match(warning.text, /2 proposals marked/);
    assert.doesNotMatch(warning.text, /LEGACY/);

    const ok = resolveApiConsistencyCheckDisplay(
      "revision",
      {
        checkId: "changes-have-origin",
        status: "ok",
        params: { count: 0 },
      },
      t,
    );
    assert.equal(ok.mode, "semantic");
    assert.match(ok.text, /Author-originated/);
  });

  it("localizes revision consistency labels", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    assert.equal(
      resolveApiConsistencyLabelDisplay(
        "revision",
        {
          checkId: "accepted-proposals-traced",
          status: "warning",
          label: "English Label",
          params: {},
        },
        t,
      ),
      "Accepted proposals traced into a change",
    );
  });
});

describe("08E.9c semantic payload without legacy English", () => {
  it("conflict presentation works without message/sectionLabel", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConflictWarningDisplay(
      {
        code: "multiple_changes_same_section",
        section: "title",
        changeIds: ["a", "b"],
        proposalIds: [],
        params: { changeCount: 2 },
      },
      t,
    );
    assert.equal(presentation.mode, "semantic");
    assert.match(presentation.text, /2 changes target the Title section/);
  });

  it("consistency presentation works without detail/label", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConsistencyCheckDisplay(
      "petition",
      {
        checkId: "revision-available",
        status: "warning",
        params: {},
      },
      t,
    );
    assert.equal(presentation.mode, "semantic");
    assert.match(presentation.text, /No Published Revision/);
  });

  it("unknown code without legacy prose uses generic fallback", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    const t = translatorFor(loaded.messages);
    const presentation = resolveApiConsistencyCheckDisplay(
      "petition",
      {
        checkId: "totally-unknown",
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
});

describe("08E.9c Revision panel uses semantic presentation", () => {
  it("RevisionIntelligenceSnapshotPanel resolves consistency via apiConsistency", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const panel = readFileSync(
      path.join(
        here,
        "../initiative-version-revision/components/InitiativeRevisionIntelligenceSnapshotPanel.tsx",
      ),
      "utf8",
    );
    assert.match(panel, /resolveApiConsistencyCheckDisplay\("revision"/);
    assert.match(panel, /resolveApiConsistencyLabelDisplay\("revision"/);
    assert.doesNotMatch(panel, /check\.detail/);
    assert.doesNotMatch(panel, /\{check\.label\}/);
    assert.match(panel, /resolveApiConflictWarningDisplay/);
  });
});

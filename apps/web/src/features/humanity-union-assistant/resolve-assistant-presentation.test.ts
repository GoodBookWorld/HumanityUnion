import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HUMANITY_UNION_ASSISTANT_SURFACE_IDS } from "@hu/types";

import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { resolveInitiativeExperienceMessage } from "../public-initiative-experience/initiative-experience-i18n.js";
import { resolveAssistantPresentation } from "./resolve-assistant-presentation.js";

describe("resolveAssistantPresentation", () => {
  it("resolves English greeting / feature / questions with Brand siteName", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = (key: string, values?: Record<string, string | number | Date>) => {
      const template = resolveInitiativeExperienceMessage(en.messages, key);
      assert.ok(template, `missing ${key}`);
      if (!values) {
        return template;
      }
      return template.replace(/\{(\w+)\}/g, (_, name: string) =>
        values[name] !== undefined ? String(values[name]) : `{${name}}`,
      );
    };

    const presentation = resolveAssistantPresentation({
      surfaceId: "workspace",
      displayName: "Alex Author",
      siteName: "Спілка Людства",
      t,
    });

    assert.equal(presentation.featureLabel, "Workspace");
    assert.match(presentation.greeting, /^Hello, Alex\./);
    assert.match(presentation.greeting, /Спілка Людства/);
    assert.doesNotMatch(presentation.greeting, /Humanity Union/);
    assert.equal(presentation.suggestedQuestions.length, 3);
    assert.equal(presentation.suggestedQuestions[0], "What should I review next?");
  });

  it("uses publicationAuthoring override for blog editor", async () => {
    const en = await loadUiMessagesForLocale("en");
    const t = (key: string, values?: Record<string, string | number | Date>) => {
      const template = resolveInitiativeExperienceMessage(en.messages, key);
      assert.ok(template, `missing ${key}`);
      if (!values) {
        return template;
      }
      return template.replace(/\{(\w+)\}/g, (_, name: string) =>
        values[name] !== undefined ? String(values[name]) : `{${name}}`,
      );
    };

    const presentation = resolveAssistantPresentation({
      surfaceId: "blog",
      displayName: "Author",
      siteName: "Humanity Union",
      t,
      publicationAuthoring: true,
    });

    assert.equal(presentation.featureLabel, "Publication Authoring");
    assert.match(presentation.suggestedQuestions[0]!, /clearer title/i);
  });

  it("catalogs cover every surface id plus publicationAuthoring in all locales", async () => {
    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const surfaceId of [
        ...HUMANITY_UNION_ASSISTANT_SURFACE_IDS,
        "publicationAuthoring",
      ]) {
        for (const field of ["featureLabel", "greeting", "q1", "q2", "q3"] as const) {
          const key = `assistant.surfaces.${surfaceId}.${field}`;
          const value = resolveInitiativeExperienceMessage(loaded.messages, key);
          assert.ok(value, `${locale} missing ${key}`);
          if (field === "greeting") {
            assert.match(value, /\{siteName\}/);
            assert.match(value, /\{name\}/);
            assert.match(value, /\{feature\}/);
          }
        }
      }
      const title = resolveInitiativeExperienceMessage(
        loaded.messages,
        "assistant.modal.title",
      );
      assert.match(title!, /\{siteName\}/);
      assert.doesNotMatch(title!, /Humanity Union/);
    }
  });
});

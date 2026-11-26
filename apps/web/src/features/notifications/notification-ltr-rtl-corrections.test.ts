/**
 * HU-LOC-BRAND-02D19B — shared notification direction corrections.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isolateLtrPlaceholder } from "./components/isolate-ltr-placeholder.js";

const featureDir = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(featureDir, relativePath), "utf8");
}

function ruleBody(css: string, selector: string): string {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`);
  const match = css.match(pattern);
  assert.ok(match, `missing rule ${selector}`);
  return match[1] ?? "";
}

describe("HU-LOC-BRAND-02D19B notification LTR/RTL corrections", () => {
  const widgetCss = () => read("components/email-notifications-settings-widget.css");
  const cardCss = () => read("components/communication-card.css");
  const widget = () => read("components/EmailNotificationsSettingsWidget.tsx");

  it("keeps the chevron pointing down and up with physical glyph edges", () => {
    const css = widgetCss();
    const chevron = ruleBody(css, ".email-notifications-settings__chevron");
    assert.match(chevron, /border-right:\s*2px solid/);
    assert.match(chevron, /border-bottom:\s*2px solid/);
    assert.match(chevron, /transform:\s*rotate\(45deg\)/);
    assert.match(chevron, /transition:\s*transform 0\.15s ease/);
    assert.doesNotMatch(chevron, /border-inline|border-left|border-top/);
    const expanded = ruleBody(
      css,
      '.email-notifications-settings__trigger[aria-expanded="true"] .email-notifications-settings__chevron',
    );
    assert.match(expanded, /transform:\s*rotate\(-135deg\)/);
    assert.doesNotMatch(css, /\[lang=|\[dir="rtl"\] \.email-notifications-settings__chevron/);
  });

  it("places the unread accent and action indent on the inline start", () => {
    const css = cardCss();
    const unread = ruleBody(css, ".communication-card--unread");
    assert.match(unread, /border-inline-start:\s*4px solid var\(--hu-color-primary\)/);
    assert.doesNotMatch(unread, /border-left|border-right|border:\s/);
    const actions = ruleBody(css, ".communication-card__actions");
    assert.match(actions, /padding-inline-start:\s*calc\(40px \+ var\(--hu-space-3\)\)/);
    assert.doesNotMatch(actions, /padding-left|padding-right/);
    const narrow = css.slice(css.indexOf("@media (max-width: 480px)"));
    assert.match(
      narrow,
      /\.communication-card__actions\s*\{[^}]*padding-inline-start:\s*0;/,
    );
    assert.doesNotMatch(narrow, /padding-left/);
    const baseIndex = css.indexOf(".communication-card {");
    const unreadIndex = css.indexOf(".communication-card--unread {");
    assert.ok(baseIndex >= 0 && unreadIndex > baseIndex);
  });

  it("keeps the accordion focus ring inside the overflow container", () => {
    const css = widgetCss();
    const card = ruleBody(css, ".email-notifications-settings");
    const trigger = ruleBody(css, ".email-notifications-settings__trigger:focus-visible");
    assert.match(card, /overflow-x:\s*hidden/);
    assert.match(trigger, /outline:\s*2px solid var\(--ens-focus\)/);
    assert.match(
      trigger,
      /outline-offset:\s*calc\(-1 \* \(2px \+ var\(--hu-focus-offset, 2px\)\)\)/,
    );
    assert.doesNotMatch(trigger, /\[dir|\[lang/);
  });

  it("isolates email placeholders without rewriting the translated sentence", () => {
    const email = "person.name@example.com";
    assert.deepEqual(isolateLtrPlaceholder("قبل {email} بعد", "email", email), [
      { type: "text", text: "قبل " },
      { type: "ltr", text: email },
      { type: "text", text: " بعد" },
    ]);
    assert.deepEqual(isolateLtrPlaceholder("{email} فقط", "email", email), [
      { type: "ltr", text: email },
      { type: "text", text: " فقط" },
    ]);
    assert.deepEqual(isolateLtrPlaceholder("النهاية {email}", "email", email), [
      { type: "text", text: "النهاية " },
      { type: "ltr", text: email },
    ]);
    assert.deepEqual(
      isolateLtrPlaceholder("{email} و {email}", "email", email),
      [
        { type: "ltr", text: email },
        { type: "text", text: " و " },
        { type: "ltr", text: email },
      ],
    );
    assert.deepEqual(isolateLtrPlaceholder("لا يوجد عنوان", "email", email), [
      { type: "text", text: "لا يوجد عنوان" },
    ]);
    assert.deepEqual(isolateLtrPlaceholder("", "email", email), [{ type: "text", text: "" }]);
    assert.deepEqual(isolateLtrPlaceholder("{ email }", "email", email), [
      { type: "text", text: "{ email }" },
    ]);
    const embedded = "user{email}@example.com";
    assert.deepEqual(isolateLtrPlaceholder("قبل {email}", "email", embedded), [
      { type: "text", text: "قبل " },
      { type: "ltr", text: embedded },
    ]);
  });

  it("renders catalog email sentences through an isolated bdi and leaves catalogs unchanged", () => {
    const source = widget();
    assert.match(source, /<bdi dir="ltr" key=\{index\}>/);
    assert.match(source, /isolateLtrPlaceholder\(template, "email", email\)/);
    assert.match(source, /t\.raw\(key\)/);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|\\u202[A-E]|\\u206[6-9]/);
    assert.match(source, /dir="ltr"/);
    assert.match(source, /email-notifications-settings__ltr-field/);
    assert.match(source, /inputMode="numeric"/);
    assert.match(source, /autoComplete="email"/);
    assert.match(source, /autoComplete="one-time-code"/);
    assert.match(source, /t\("resendCooldown", \{ seconds: cooldownSeconds \}\)/);

    for (const locale of ["en", "ar", "he", "uk", "zh-Hant", "de"] as const) {
      const messages = JSON.parse(
        read(`../i18n/messages/${locale}.json`),
      ) as {
        notifications: { emailSettings: Record<string, string> };
      };
      const settings = messages.notifications.emailSettings;
      for (const key of [
        "destinationAccount",
        "destinationAlternative",
        "loginEmailHint",
        "verifiedAlternative",
        "pendingAlternative",
      ]) {
        assert.match(settings[key] ?? "", /\{email\}/);
        assert.doesNotMatch(settings[key] ?? "", /<bdi|[\u202A-\u202E\u2066-\u2069]/);
        const parts = isolateLtrPlaceholder(settings[key] ?? "", "email", "user@example.com");
        assert.equal(
          parts.filter((part) => part.type === "ltr").map((part) => part.text).join(""),
          "user@example.com",
        );
        assert.equal(
          parts.map((part) => (part.type === "text" ? part.text : part.text)).join(""),
          (settings[key] ?? "").replaceAll("{email}", "user@example.com"),
        );
      }
      assert.match(settings.resendCooldown ?? "", /\{seconds\}/);
    }
  });
});

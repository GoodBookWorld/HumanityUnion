/**
 * HU-RRP-07F.2 — localized appointment welcome message.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveCountryDisplayName } from "@hu/geography";

import { resolveLocaleWithEnglishFallback } from "../../../src/modules/language/language-registry-runtime.js";
import {
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/language-registry.repository.js";
import { buildRrpAppointmentApprovalClientMessageId } from "../../../src/modules/rrp-application/rrp-message-intent.constants.js";
import { buildSafeRequestInformationMessageText } from "../../../src/modules/rrp-application/rrp-message-intent.delivery.js";
import {
  APPOINTMENT_WELCOME_LOCALES,
  renderAppointmentWelcomeMessage,
  selectWelcomeDisplayName,
} from "../../../src/modules/rrp-application/rrp-appointment-welcome-message.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

const PRIVATE_APPLICATION_FIELDS =
  /legalFirstName|legalLastName|dateOfBirth|motivation|relevantExperience|annualRequestedAmount|fundingModel/;

describe("HU-RRP-07F.2 appointment welcome message", () => {
  it("personalizes a safe public display name and does not split it", () => {
    const name = selectWelcomeDisplayName({
      profileDisplayName: "Mara Chen",
      authDisplayName: "Other Name",
    });
    assert.equal(name, "Mara Chen");
    const text = renderAppointmentWelcomeMessage({
      displayName: name,
      countryCode: "CA",
      locale: "en",
    });
    assert.match(text, /^Hello, Mara Chen!\n\n/);
    assert.match(text, /for Canada!/);
    assert.doesNotMatch(text, /Hello, Mara!/);
  });

  it("uses the auth display name only when the profile name is missing", () => {
    assert.equal(
      selectWelcomeDisplayName({
        profileDisplayName: "  ",
        authDisplayName: "Auth Person",
      }),
      "Auth Person",
    );
    assert.equal(
      selectWelcomeDisplayName({
        profileDisplayName: null,
        authDisplayName: "Auth Person",
      }),
      "Auth Person",
    );
  });

  it("uses a nameless greeting when the display name is missing or unsafe", () => {
    assert.equal(selectWelcomeDisplayName({ profileDisplayName: null, authDisplayName: null }), null);
    assert.equal(
      selectWelcomeDisplayName({ profileDisplayName: "Ann <script>", authDisplayName: "Safe Auth" }),
      null,
    );
    assert.equal(
      selectWelcomeDisplayName({ profileDisplayName: "Line\nBreak", authDisplayName: "Safe Auth" }),
      null,
    );
    assert.equal(selectWelcomeDisplayName({ profileDisplayName: "", authDisplayName: "Bad>" }), null);

    const text = renderAppointmentWelcomeMessage({
      displayName: "Unsafe <name>",
      countryCode: "CA",
      locale: "en",
    });
    assert.match(text, /^Hello!\n\n/);
    assert.doesNotMatch(text, /Unsafe|<name>/);
  });

  it("uses the full country name for CA and leaves an unknown code unchanged", () => {
    const canada = renderAppointmentWelcomeMessage({
      displayName: "Mara Chen",
      countryCode: "CA",
      locale: "en",
    });
    assert.match(canada, /for Canada!/);
    assert.equal(
      resolveCountryDisplayName({ countryCode: "CA", locale: "en" }).displayName,
      "Canada",
    );

    const unknown = renderAppointmentWelcomeMessage({
      displayName: "Mara Chen",
      countryCode: "ZZ",
      locale: "en",
    });
    assert.match(unknown, /for ZZ!/);
    assert.doesNotMatch(unknown, /Canada/);
  });

  it("renders every installed locale and falls back to English for any other locale", () => {
    const english = renderAppointmentWelcomeMessage({
      displayName: "Mara Chen",
      countryCode: "CA",
      locale: "en",
    });
    assert.equal(APPOINTMENT_WELCOME_LOCALES.length, 10);

    for (const locale of APPOINTMENT_WELCOME_LOCALES) {
      const text = renderAppointmentWelcomeMessage({
        displayName: "Mara Chen",
        countryCode: "CA",
        locale,
      });
      const country = resolveCountryDisplayName({ countryCode: "CA", locale }).displayName;
      assert.match(text, /Mara Chen/);
      assert.match(text, new RegExp(country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(text, /\{name\}|\{country\}/);
      assert.doesNotMatch(text, PRIVATE_APPLICATION_FIELDS);
      if (locale !== "en") {
        assert.notEqual(text, english);
      }
    }

    assert.equal(
      renderAppointmentWelcomeMessage({ countryCode: "CA", locale: "ja" }),
      renderAppointmentWelcomeMessage({ countryCode: "CA", locale: "en" }),
    );
  });

  it("resolves a disabled or unknown interface language to English", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    assert.equal(await resolveLocaleWithEnglishFallback("uk"), "en");
    assert.equal(await resolveLocaleWithEnglishFallback("de"), "en");
    assert.equal(await resolveLocaleWithEnglishFallback("no-such-locale"), "en");
    assert.equal(await resolveLocaleWithEnglishFallback(null), "en");
    resetLanguageRegistryStoreForTests();
  });

  it("keeps the welcome, confidentiality invitation, and platform disclaimer", () => {
    const text = renderAppointmentWelcomeMessage({
      displayName: "Mara Chen",
      countryCode: "CA",
      locale: "en",
    });
    assert.match(text, /Congratulations on your appointment as a Regional Representative/);
    assert.match(text, /confidential/);
    assert.match(text, /ask questions, share your ideas/);
    assert.match(text, /plans for developing Humanity Union in your region/);
    assert.match(text, /does not independently grant administrative or legal authority/);
    assert.match(text, /establish employment/);
    assert.match(text, /commitment to provide funding/);
    assert.match(text, /Welcome to the Humanity Union team!/);
  });

  it("keeps the request-information message separate from the appointment welcome", () => {
    const text = buildSafeRequestInformationMessageText({
      representCountryCode: "CA",
      requestExplanation: "Please clarify experience.",
    });
    assert.match(text, /More Information Is Needed/);
    assert.match(text, /for Canada/);
    assert.match(text, /Please clarify experience/);
    assert.doesNotMatch(text, /Welcome to the Humanity Union team/);
  });

  it("keeps delivery idempotent and free of private application fields and message bodies in logs", () => {
    const delivery = readApi("modules/rrp-application/rrp-message-intent.delivery.ts");
    const welcome = readApi("modules/rrp-application/rrp-appointment-welcome-message.ts");
    const repository = readApi("modules/rrp-application/rrp-appointment-message-intent.repository.ts");

    assert.match(delivery, /findMemberProfileByUserId/);
    assert.match(delivery, /findAuthUserByMemberId/);
    assert.match(delivery, /interfaceLanguage/);
    assert.match(delivery, /resolveLocaleWithEnglishFallback/);
    assert.match(delivery, /renderAppointmentWelcomeMessage/);
    assert.match(delivery, /clientMessageId: intent\.clientMessageId/);
    assert.match(delivery, /buildSafeRequestInformationMessageText/);
    assert.doesNotMatch(delivery, /updateDirectMessage|text:\s*intent/);
    assert.doesNotMatch(delivery, PRIVATE_APPLICATION_FIELDS);
    assert.doesNotMatch(welcome, PRIVATE_APPLICATION_FIELDS);
    assert.doesNotMatch(repository, /welcomeBody|renderedText|messageText/);
    assert.match(
      delivery,
      /error: message\.slice\(0, 200\)/,
    );
    assert.equal(
      buildRrpAppointmentApprovalClientMessageId("appointment-1"),
      "rrp-appointment:appointment-1",
    );
  });
});

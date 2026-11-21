/**
 * HU-RRP-07F.4 — localized request-information message.
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
import { renderAppointmentWelcomeMessage } from "../../../src/modules/rrp-application/rrp-appointment-welcome-message.js";
import { APPOINTMENT_WELCOME_LOCALES } from "../../../src/modules/rrp-application/rrp-appointment-welcome-message.js";
import { buildRrpRequestInformationClientMessageId } from "../../../src/modules/rrp-application/rrp-message-intent.constants.js";
import {
  renderRequestInformationMessage,
  sanitizeRequestInformationNote,
} from "../../../src/modules/rrp-application/rrp-request-information-message.js";

const APPLICATION_ID = "2eb77c63-62e8-4c2c-be6a-9de40e6533e3";
const PRIVATE_APPLICATION_FIELDS =
  /legalFirstName|legalLastName|dateOfBirth|motivation|relevantExperience|annualRequestedAmount|fundingModel/;

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

describe("HU-RRP-07F.4 request-information message", () => {
  it("renders the English structure with a full country name and the original note", () => {
    const text = renderRequestInformationMessage({
      countryCode: "BE",
      locale: "en",
      requestExplanation: "Please describe your regional plan.",
    });
    assert.match(text, /^More Information Is Needed\n\n/);
    assert.match(
      text,
      /An administrator has requested additional information about your Regional Representative application for Belgium\./,
    );
    assert.match(text, /What is needed:\n\nPlease describe your regional plan\./);
    assert.match(text, /Next step:\n\nOpen My Regional Applications in your Workspace/);
    assert.match(text, /This request does not change your account role or grant legal authority\./);
    assert.doesNotMatch(text, /BE/);
    assert.doesNotMatch(text, new RegExp(APPLICATION_ID));
  });

  it("renders every installed locale and falls back to English otherwise", async () => {
    const english = renderRequestInformationMessage({
      countryCode: "CA",
      locale: "en",
      requestExplanation: "Please clarify experience.",
    });
    assert.equal(APPOINTMENT_WELCOME_LOCALES.length, 10);
    for (const locale of APPOINTMENT_WELCOME_LOCALES) {
      const text = renderRequestInformationMessage({
        countryCode: "CA",
        locale,
        requestExplanation: "Please clarify experience.",
      });
      const country = resolveCountryDisplayName({ countryCode: "CA", locale }).displayName;
      assert.match(text, /Please clarify experience\./);
      assert.match(text, new RegExp(country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(text, /\{country\}/);
      assert.doesNotMatch(text, PRIVATE_APPLICATION_FIELDS);
      if (locale !== "en") {
        assert.notEqual(text, english);
      }
    }
    assert.equal(
      renderRequestInformationMessage({ countryCode: "CA", locale: "ja", requestExplanation: "Note." }),
      renderRequestInformationMessage({ countryCode: "CA", locale: "en", requestExplanation: "Note." }),
    );

    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    try {
      assert.equal(await resolveLocaleWithEnglishFallback("uk"), "en");
      assert.equal(await resolveLocaleWithEnglishFallback("no-such-locale"), "en");
      assert.equal(await resolveLocaleWithEnglishFallback(null), "en");
    } finally {
      resetLanguageRegistryStoreForTests();
    }
  });

  it("uses the country code when the code is unknown", () => {
    const text = renderRequestInformationMessage({
      countryCode: "ZZ",
      locale: "en",
      requestExplanation: "Please clarify experience.",
    });
    assert.match(text, /for ZZ\./);
    assert.doesNotMatch(text, /Canada|Belgium/);
  });

  it("preserves meaningful line breaks in the administrator note", () => {
    const text = renderRequestInformationMessage({
      countryCode: "CA",
      locale: "en",
      requestExplanation: "First, describe the region.\n\nThen name the partners.",
    });
    assert.match(text, /What is needed:\n\nFirst, describe the region\.\n\nThen name the partners\./);
  });

  it("removes angle brackets and control characters without dropping the note", () => {
    assert.equal(
      sanitizeRequestInformationNote("Use the <portal> and keep\u0000 this line.\nNext line."),
      "Use the portal and keep this line.\nNext line.",
    );
    const text = renderRequestInformationMessage({
      countryCode: "CA",
      locale: "en",
      requestExplanation: "Compare a < b\u0007 and then continue.",
    });
    assert.match(text, /Compare a  b and then continue\./);
    assert.doesNotMatch(text, /[<>]/);
    assert.doesNotMatch(text, /\u0007/);
  });

  it("does not show an application id or private application fields", () => {
    const message = readApi("modules/rrp-application/rrp-request-information-message.ts");
    const delivery = readApi("modules/rrp-application/rrp-message-intent.delivery.ts");
    const text = renderRequestInformationMessage({
      countryCode: "CA",
      locale: "en",
      requestExplanation: "Please clarify experience.",
    });
    assert.doesNotMatch(text, new RegExp(APPLICATION_ID));
    assert.doesNotMatch(text, PRIVATE_APPLICATION_FIELDS);
    assert.doesNotMatch(message, PRIVATE_APPLICATION_FIELDS);
    assert.doesNotMatch(message, /applicationId/);
    assert.doesNotMatch(delivery, PRIVATE_APPLICATION_FIELDS);
    assert.match(delivery, /error: message\.slice\(0, 200\)/);
    assert.doesNotMatch(delivery, /console\.warn\([\s\S]*requestExplanation/);
  });

  it("keeps the request clientMessageId and leaves the appointment welcome unchanged", () => {
    assert.equal(
      buildRrpRequestInformationClientMessageId({
        applicationId: APPLICATION_ID,
        applicationRevision: 4,
      }),
      `rrp-request-info:${APPLICATION_ID}:r4`,
    );
    const welcome = renderAppointmentWelcomeMessage({
      displayName: "Mara Chen",
      countryCode: "CA",
      locale: "en",
    });
    assert.match(welcome, /^Hello, Mara Chen!\n\nCongratulations on your appointment/);
    assert.match(welcome, /for Canada!/);
    assert.match(welcome, /Welcome to the Humanity Union team!/);
    const constants = readApi("modules/rrp-application/rrp-message-intent.constants.ts");
    assert.match(constants, /rrp-request-info:\$\{input\.applicationId\}:r\$\{input\.applicationRevision\}/);
  });
});

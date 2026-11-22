/**
 * HU-RRP-MSG-01B — published humanity_union term in RRP automatic messages.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { TerminologyConcept, TerminologyConceptStatus } from "@hu/types";

import {
  RRP_CANONICAL_BRAND_NAME,
  resolveRrpMessageBrandSiteName,
  selectPublishedHumanityUnionBrandTerm,
} from "../../../src/modules/rrp-application/rrp-message-brand.js";
import { APPOINTMENT_WELCOME_LOCALES } from "../../../src/modules/rrp-application/rrp-appointment-welcome-message.js";
import { renderAppointmentWelcomeMessage } from "../../../src/modules/rrp-application/rrp-appointment-welcome-message.js";
import { renderRequestInformationMessage } from "../../../src/modules/rrp-application/rrp-request-information-message.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function readApi(relative: string): string {
  return readFileSync(path.join(apiSrc, relative), "utf8");
}

function brandConcept(
  status: TerminologyConceptStatus,
  translations: TerminologyConcept["translations"],
): TerminologyConcept {
  return {
    conceptId: "humanity_union",
    canonicalEnglishTerm: RRP_CANONICAL_BRAND_NAME,
    category: "brand",
    translations,
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("HU-RRP-MSG-01B RRP message brand terminology", () => {
  it("uses the published preferred term for every installed locale", () => {
    assert.equal(APPOINTMENT_WELCOME_LOCALES.length, 10);
    for (const locale of APPOINTMENT_WELCOME_LOCALES) {
      const preferred = locale === "en" ? RRP_CANONICAL_BRAND_NAME : `Brand-${locale}`;
      const selected = selectPublishedHumanityUnionBrandTerm(
        [
          brandConcept("published", {
            [locale]: { preferredTerm: preferred, aliases: [] },
          }),
        ],
        locale,
      );
      assert.equal(selected, preferred);

      const welcome = renderAppointmentWelcomeMessage({
        displayName: "Mara Chen",
        countryCode: "CA",
        locale,
        siteName: selected,
      });
      const request = renderRequestInformationMessage({
        countryCode: "CA",
        locale,
        requestExplanation: "Please clarify experience.",
        siteName: selected,
      });
      assert.match(welcome, new RegExp(preferred.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(welcome, /\{siteName\}|\{name\}|\{country\}/);
      assert.match(request, /Please clarify experience\./);
      assert.doesNotMatch(request, /\{siteName\}|\{country\}/);
      if (locale !== "en") {
        assert.match(request, new RegExp(preferred.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.doesNotMatch(welcome, /Humanity Union/);
      }
    }
  });

  it("falls back to the canonical brand when the published term is missing or unsafe", () => {
    const missing = selectPublishedHumanityUnionBrandTerm(
      [brandConcept("published", {})],
      "uk",
    );
    assert.equal(missing, RRP_CANONICAL_BRAND_NAME);

    const blank = selectPublishedHumanityUnionBrandTerm(
      [brandConcept("published", { uk: { preferredTerm: "   ", aliases: [] } })],
      "uk",
    );
    assert.equal(blank, RRP_CANONICAL_BRAND_NAME);

    const unsafe = selectPublishedHumanityUnionBrandTerm(
      [brandConcept("published", { uk: { preferredTerm: "Brand <script>", aliases: [] } })],
      "uk",
    );
    assert.equal(unsafe, RRP_CANONICAL_BRAND_NAME);

    const welcome = renderAppointmentWelcomeMessage({
      countryCode: "CA",
      locale: "uk",
    });
    assert.match(welcome, /Humanity Union/);
    assert.doesNotMatch(welcome, /\{siteName\}/);
  });

  it("ignores draft and retired glossary terms", () => {
    for (const status of ["draft", "retired"] as const) {
      const selected = selectPublishedHumanityUnionBrandTerm(
        [brandConcept(status, { uk: { preferredTerm: "Brand-uk", aliases: [] } })],
        "uk",
      );
      assert.equal(selected, RRP_CANONICAL_BRAND_NAME);
    }
  });

  it("keeps delivery moving when glossary lookup fails and does not rewrite a delivered body", async () => {
    const resolved = await resolveRrpMessageBrandSiteName("uk", async () => {
      throw new Error("glossary unavailable");
    });
    assert.equal(resolved, RRP_CANONICAL_BRAND_NAME);

    const delivery = readApi("modules/rrp-application/rrp-message-intent.delivery.ts");
    const deliverFn = delivery.slice(
      delivery.indexOf("export async function deliverRrpMessageIntentBestEffort"),
    );
    const deliveredCheck = deliverFn.indexOf('intent.status === "delivered"');
    const renderCall = deliverFn.indexOf("buildMessageText(intent)");
    assert.ok(deliveredCheck >= 0 && deliveredCheck < renderCall);
    assert.match(delivery, /resolveRrpMessageBrandSiteName\(context\.locale\)/);
    assert.match(delivery, /resolveRrpMessageBrandSiteName\(welcome\.locale\)/);
    assert.doesNotMatch(delivery, /brand-localization|resolveLocalizedBrand/);
    assert.doesNotMatch(delivery, /replaceAll\(\s*["']Humanity Union["']\s*\)/);
    assert.doesNotMatch(delivery, /updateDirectMessage/);
  });

  it("attaches a conversation id only for an active Representative appointment", () => {
    const service = readApi("modules/rrp-application/rrp-application.service.ts");
    const resolution = readApi("modules/rrp-application/rrp-admin-conversation.resolution.ts");
    const listFn = service.slice(
      service.indexOf("export async function listOwnRrpApplicationsForUser"),
      service.indexOf("export async function getOwnRrpApplicationForUser"),
    );
    const getFn = service.slice(
      service.indexOf("export async function getOwnRrpApplicationForUser"),
      service.indexOf("export async function resolveOwnRrpAdminConversationForUser"),
    );
    const resolverFn = service.slice(
      service.indexOf("export async function resolveOwnRrpAdminConversationForUser"),
    );
    assert.match(listFn, /isRrpRepresentativeConversationLinkEligible/);
    assert.match(getFn, /isRrpRepresentativeConversationLinkEligible/);
    assert.doesNotMatch(resolverFn, /isRrpRepresentativeConversationLinkEligible/);
    assert.match(resolution, /buildDirectConversationId/);
    assert.doesNotMatch(resolution, /openOrCreateDirectConversation/);
    assert.doesNotMatch(service, /openOrCreateDirectConversation/);
    assert.doesNotMatch(listFn, /adminParticipantId/);
  });
});

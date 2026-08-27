/**
 * Pack 25A — Membership application geography HTTP parser fix + contribution unlock.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { parseApplicationBody } from "../../../src/modules/membership/membership-application-body.js";
import { MembershipValidationError } from "../../../src/modules/membership/membership.errors.js";
import { validateApplicationInput } from "../../../src/modules/membership/membership.validators.js";
import { buildMembershipTimeline } from "../../../src/modules/membership/membership.projection.js";
import type { MembershipRecord } from "@hu/types";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const apiSrc = path.join(apiRoot, "src");
const webSrc = path.resolve(apiRoot, "../web/src");

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiSrc, relativePath), "utf8");
}

function readWeb(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

function baseDeclarations(overrides: Record<string, unknown> = {}) {
  return {
    displayNameConfirmed: "Civic Participant",
    understandMembershipMeaning: true,
    understandNoVoteWeightChange: true,
    understandDataPolicy: true,
    submit: true,
    ...overrides,
  };
}

describe("Pack 25A — Membership geography parser + contribution unlock", () => {
  it("1 — parser forwards participationCountryCodes (not dropped)", () => {
    const parsed = parseApplicationBody({
      ...baseDeclarations(),
      participationCountryCodes: ["CA"],
    });

    assert.deepEqual(parsed.participationCountryCodes, ["CA"]);
    assert.notEqual(parsed.participationCountryCodes, undefined);
    assert.equal(Array.isArray(parsed.participationCountryCodes), true);
    assert.notDeepEqual(parsed.participationCountryCodes, []);
  });

  it("2 — one valid country succeeds through parser → validator", () => {
    const parsed = parseApplicationBody({
      ...baseDeclarations(),
      participationCountryCodes: ["ca"],
    });
    const validated = validateApplicationInput(parsed);

    assert.deepEqual(validated.participationCountryCodes, ["CA"]);
    assert.equal(validated.countryCode, "CA");
    assert.equal(validated.submit, true);
  });

  it("3 — multiple valid countries succeed and stay an array", () => {
    const parsed = parseApplicationBody({
      ...baseDeclarations(),
      participationCountryCodes: ["CA", "US", "fr"],
    });
    const validated = validateApplicationInput(parsed);

    assert.deepEqual(validated.participationCountryCodes, ["CA", "US", "FR"]);
    assert.equal(validated.countryCode, "CA");
    assert.ok(validated.participationCountryCodes.length > 1);
  });

  it("4 — empty countries rejected", () => {
    const parsed = parseApplicationBody({
      ...baseDeclarations(),
      participationCountryCodes: [],
    });

    assert.throws(
      () => validateApplicationInput(parsed),
      (error: unknown) =>
        error instanceof MembershipValidationError &&
        /Select at least one country of civic participation/.test(error.message),
    );
  });

  it("5 — missing field rejected when no legacy countryCode", () => {
    const parsed = parseApplicationBody({
      ...baseDeclarations(),
    });

    assert.equal(parsed.participationCountryCodes, undefined);
    assert.throws(
      () => validateApplicationInput(parsed),
      (error: unknown) =>
        error instanceof MembershipValidationError &&
        /Select at least one country of civic participation/.test(error.message),
    );
  });

  it("6 — malformed non-array participationCountryCodes does not invent countries", () => {
    const parsed = parseApplicationBody({
      ...baseDeclarations(),
      participationCountryCodes: "CA",
    });

    assert.equal(parsed.participationCountryCodes, undefined);
    assert.throws(() => validateApplicationInput(parsed), MembershipValidationError);
  });

  it("7 — invalid country rejected", () => {
    const parsed = parseApplicationBody({
      ...baseDeclarations(),
      participationCountryCodes: ["ZZ"],
    });

    assert.throws(
      () => validateApplicationInput(parsed),
      (error: unknown) =>
        error instanceof MembershipValidationError &&
        /approved geography list|ISO 3166-1/.test(error.message),
    );
  });

  it("8–9 — non-string array entries stripped; duplicates collapsed by validator", () => {
    const parsed = parseApplicationBody({
      ...baseDeclarations(),
      participationCountryCodes: ["CA", 12, null, "CA", "US"] as unknown as string[],
    });

    assert.deepEqual(parsed.participationCountryCodes, ["CA", "CA", "US"]);
    const validated = validateApplicationInput(parsed);
    assert.deepEqual(validated.participationCountryCodes, ["CA", "US"]);
  });

  it("10–11 — submit status contract remains application_completed + submitted", () => {
    const service = readApi("modules/membership/membership.service.ts");
    assert.match(service, /application_completed/);
    assert.match(service, /applicationStatus:\s*"submitted"|"submitted"/);
    assert.doesNotMatch(
      service,
      /submit[\s\S]{0,80}status:\s*"application_started"/,
    );
  });

  it("12 — contribution unlocks when applicationStatus submitted/approved", () => {
    const card = readWeb("features/membership/components/MembershipContributionCard.tsx");
    assert.match(card, /applicationStatus === "submitted"/);
    assert.match(card, /applicationStatus === "approved"/);
    assert.match(card, /canContribute/);
    assert.match(card, /Become a Member/);
  });

  it("13 — checkout CTA uses existing POST /api/v1/membership/checkout", () => {
    const api = readWeb("features/membership/membership-api.ts");
    assert.match(api, /\/api\/v1\/membership\/checkout/);
    assert.match(api, /startMembershipContribution/);
    const routes = readApi("modules/membership/membership.routes.ts");
    assert.match(routes, /post\("\/checkout"/);
  });

  it("14–15 — CAD 1 intent + Stripe Price ID path unchanged", () => {
    const constants = readApi("modules/membership-payment/membership-payment.constants.ts");
    assert.match(constants, /MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS\s*=\s*100/);
    assert.match(constants, /MEMBERSHIP_CONTRIBUTION_CURRENCY\s*=\s*"cad"/);
    const paymentService = readApi("modules/membership-payment/membership-payment.service.ts");
    assert.match(paymentService, /priceId|STRIPE_MEMBERSHIP_PRICE_ID|config\.priceId/);
    const config = readApi("modules/membership-payment/membership-payment.config.ts");
    assert.match(config, /STRIPE_MEMBERSHIP_PRICE_ID/);
  });

  it("16–17 — email gate + declarations validation still wired", () => {
    const service = readApi("modules/membership/membership.service.ts");
    assert.match(service, /emailVerificationStatus !== "verified"/);
    const validators = readApi("modules/membership/membership.validators.ts");
    assert.match(validators, /All Membership acknowledgement checkboxes are required/);
  });

  it("18 — no new personal fields introduced", () => {
    const bodyParser = readApi("modules/membership/membership-application-body.ts");
    const routes = readApi("modules/membership/membership.routes.ts");
    assert.doesNotMatch(bodyParser, /dateOfBirth|passport|governmentId|phoneNumber|streetAddress/);
    assert.doesNotMatch(routes, /dateOfBirth|passport|governmentId|phoneNumber|streetAddress/);
    const form = readWeb("features/membership/components/MembershipApplicationForm.tsx");
    assert.doesNotMatch(form, /dateOfBirth|passport|governmentId|phoneNumber|streetAddress/);
  });

  it("19 — five-step timeline: after submit, contribution is current", () => {
    const membership = {
      status: "application_completed",
      applicationStatus: "submitted",
      memberNumber: null,
      memberGrantedAt: null,
    } as MembershipRecord;

    const timeline = buildMembershipTimeline({
      emailConfirmed: true,
      membership,
    });

    assert.equal(timeline.find((step) => step.id === "registration")?.state, "complete");
    assert.equal(timeline.find((step) => step.id === "email_confirmed")?.state, "complete");
    assert.equal(timeline.find((step) => step.id === "application")?.state, "complete");
    assert.equal(timeline.find((step) => step.id === "contribution")?.state, "current");
    assert.equal(timeline.find((step) => step.id === "member")?.state, "upcoming");
  });

  it("20 — Admin directory projects membership status field (application_completed visible in data)", () => {
    const directory = readApi("modules/administration/admin-participant-directory.service.ts");
    assert.match(directory, /toMembershipStatusPayload|membership:/);
    const routes = readApi("modules/administration/admin-participant-directory.routes.ts");
    assert.match(routes, /application_completed/);
  });

  it("parser is used by POST and PATCH application routes", () => {
    const routes = readApi("modules/membership/membership.routes.ts");
    assert.match(routes, /parseApplicationBody\(req\.body\)/);
    assert.equal((routes.match(/parseApplicationBody\(req\.body\)/g) ?? []).length, 2);
  });

  it("legacy countryCode still works when array omitted", () => {
    const parsed = parseApplicationBody({
      ...baseDeclarations(),
      countryCode: "US",
    });
    const validated = validateApplicationInput(parsed);
    assert.deepEqual(validated.participationCountryCodes, ["US"]);
  });

  it("post-submit UI banner no longer claims contribution is a future update", () => {
    const form = readWeb("features/membership/components/MembershipApplicationForm.tsx");
    assert.doesNotMatch(form, /future platform update/);
    assert.match(form, /Membership Contribution/);
  });
});

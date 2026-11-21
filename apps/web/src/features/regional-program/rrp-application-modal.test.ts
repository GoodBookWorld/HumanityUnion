/**
 * HU-RRP-02C — Workspace Regional Representative application modal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { RRP_APPLICATION_CONSENT_VERSION } from "@hu/types";

import {
  buildRrpDraftPayload,
  computeExactAgeYears,
  EMPTY_RRP_APPLICATION_FORM,
  formStateFromRrpApplication,
  isRrpApplicationFormDirty,
  isValidAdultDateOfBirth,
  listRrpApplicationSubmitIssues,
  resolvePrefillResidenceCountryCode,
  validateRrpApplicationFormForSubmit,
} from "./rrp-application-form.js";
import { isRrpApplicationEntryEnabled, RRP_APPLICATION_ENTRY_FLAG_ENV } from "./rrp-application-entry.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

const AS_OF = new Date("2026-11-17T15:00:00.000Z");

describe("HU-RRP-02C Workspace application modal", () => {
  it("keeps the entry flag OFF by default and gates modal open on the flag", () => {
    assert.equal(isRrpApplicationEntryEnabled({}), false);
    const home = read("app/workspace/WorkspaceHomePage.tsx");
    assert.match(home, /isRrpApplicationEntryEnabled\(\)/);
    assert.match(home, /RrpApplicationModal/);
    assert.match(home, /setModalOpen\(true\)/);
    assert.match(home, /emailVerificationStatus !== "verified"/);
  });

  it("opens only for verified participants and still routes unverified to confirm-email", () => {
    const home = read("app/workspace/WorkspaceHomePage.tsx");
    assert.match(home, /buildAuthPathWithReturnTo\("\/confirm-email"/);
    assert.match(home, /RRP_APPLICATION_ENTRY_HREF/);
  });

  it("implements accessible modal open/close with focus trap, Escape, and blur backdrop", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    const css = read("features/regional-program/components/rrp-application-modal.css");
    assert.match(modal, /role="dialog"/);
    assert.match(modal, /aria-modal="true"/);
    assert.match(modal, /trapTabKey/);
    assert.match(modal, /Escape/);
    assert.match(modal, /requestClose/);
    assert.match(modal, /aria-label=\{t\("closeAria"\)\}/);
    assert.match(css, /backdrop-filter:\s*blur/);
    assert.match(css, /\[dir="rtl"\]/);
    assert.match(css, /overflow-x:\s*hidden/);
  });

  it("does not reset hub country selection when translator identity changes", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(modal, /tRef\.current = t/);
    assert.match(modal, /\[isOpen, initialApplicationId, initialIntent\]/);
    assert.doesNotMatch(modal, /\[isOpen, initialApplicationId, initialIntent, t\]/);
  });

  it("confirms before discarding unsaved edits and avoids duplicate create retries", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(modal, /ConfirmDialog/);
    assert.match(modal, /isRrpApplicationFormDirty/);
    assert.match(modal, /discard\.title/);
    assert.match(modal, /if \(busy !== null\)/);
    assert.match(modal, /setBaselineForm/);
  });

  it("uses CountrySelect and does not auto-copy residence into representation", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(modal, /CountrySelect/);
    assert.match(modal, /resolvePrefillResidenceCountryCode/);
    assert.match(modal, /fields\.representCountryHelp/);
    assert.equal(resolvePrefillResidenceCountryCode("ca"), "CA");
    assert.equal(resolvePrefillResidenceCountryCode("NotACountry"), "");
  });

  it("validates optional DOB calendar rules without an 18+ gate", () => {
    assert.equal(computeExactAgeYears("2008-11-17", AS_OF), 18);
    assert.equal(isValidAdultDateOfBirth("2008-11-17", AS_OF), true);
    // Under-18 calendar dates are accepted when voluntarily provided.
    assert.equal(isValidAdultDateOfBirth("2008-11-18", AS_OF), true);
    assert.equal(isValidAdultDateOfBirth("2099-01-01", AS_OF), false);
    assert.equal(isValidAdultDateOfBirth("2000-02-30", AS_OF), false);
    assert.equal(
      validateRrpApplicationFormForSubmit({
        ...EMPTY_RRP_APPLICATION_FORM,
        representCountryCode: "CA",
        motivation: "Build regional collaboration",
        consentAccepted: true,
        dateOfBirth: "2015-01-01",
      }),
      null,
    );
  });

  it("accepts a minimal submit without legal identity or funding", () => {
    assert.equal(
      validateRrpApplicationFormForSubmit({
        ...EMPTY_RRP_APPLICATION_FORM,
        representCountryCode: "CA",
        motivation: "Coordinate regional civic work",
        consentAccepted: true,
      }),
      null,
    );
    assert.equal(
      validateRrpApplicationFormForSubmit({
        ...EMPTY_RRP_APPLICATION_FORM,
        representCountryCode: "CA",
        consentAccepted: true,
      }),
      "motivation",
    );
  });

  it("detects dirty form state against the saved baseline", () => {
    const baseline = formStateFromRrpApplication({
      applicationId: "a1",
      participantId: "p1",
      legalFirstName: "Alex",
      legalLastName: "Applicant",
      profession: "Organizer",
      residenceCountryCode: "CA",
      representCountryCode: "CA",
      dateOfBirth: "2000-01-01",
      fundingModel: "SELF",
      annualRequestedAmountCad: null,
      teamMemberCount: 0,
      relevantExperience: "exp",
      motivation: "mot",
      consentAcceptedAt: null,
      consentVersion: null,
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      submittedAt: null,
      reviewedAt: null,
      revision: 1,
      decisionHistory: [],
    });
    assert.equal(isRrpApplicationFormDirty(baseline, baseline), false);
    assert.equal(
      isRrpApplicationFormDirty({ ...baseline, profession: "Updated" }, baseline),
      true,
    );
  });

  it("requires CAD amount for PARTIAL/FULL and null for SELF", () => {
    const base = {
      ...EMPTY_RRP_APPLICATION_FORM,
      legalFirstName: "A",
      legalLastName: "B",
      profession: "C",
      residenceCountryCode: "CA",
      representCountryCode: "CA",
      dateOfBirth: "2000-01-01",
      teamMemberCount: "1",
      relevantExperience: "exp",
      motivation: "mot",
      consentAccepted: true,
    };
    assert.equal(
      validateRrpApplicationFormForSubmit({ ...base, fundingModel: "SELF" }),
      null,
    );
    assert.equal(
      validateRrpApplicationFormForSubmit({
        ...base,
        fundingModel: "PARTIAL",
        annualRequestedAmountCad: "",
      }),
      "annualAmount",
    );
    const payload = buildRrpDraftPayload({
      ...base,
      fundingModel: "SELF",
      annualRequestedAmountCad: "999",
    });
    // SELF payload builder still nulls amount regardless of stray UI text once model is SELF
    assert.equal(payload.annualRequestedAmountCad, null);
  });

  it("matches HU-RRP-02B API contract paths and revision/consent payload", () => {
    const api = read("features/regional-program/rrp-application-api.ts");
    const routes = readFileSync(
      path.resolve(webSrc, "../../api/src/modules/rrp-application/rrp-application.routes.ts"),
      "utf8",
    );
    assert.match(routes, /rrpApplicationRouter\.post\(\s*"\/"/);
    assert.match(routes, /rrpApplicationRouter\.get\(\s*"\/me"/);
    assert.match(routes, /rrpApplicationRouter\.patch\(\s*"\/:applicationId"/);
    assert.match(routes, /\/:applicationId\/submit/);
    assert.match(routes, /\/:applicationId\/withdraw/);
    assert.match(api, /"\/api\/v1\/rrp-applications"/);
    assert.match(api, /"\/api\/v1\/rrp-applications\/me"/);
    assert.match(api, /\/api\/v1\/rrp-applications\/\$\{encodeURIComponent\(applicationId\)\}/);
    assert.match(api, /\/submit/);
    assert.match(api, /\/withdraw/);
    assert.match(api, /expectedRevision/);
    assert.match(api, /consentAccepted: true/);
    assert.match(api, /RRP_APPLICATION_CONSENT_VERSION/);
    assert.match(api, /method: "PATCH"/);
    assert.match(api, /method: "POST"/);
  });

  it("wires draft create/update/submit/withdraw with expectedRevision and no localStorage DOB", () => {
    const api = read("features/regional-program/rrp-application-api.ts");
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(modal, /createRrpApplicationDraft/);
    assert.match(modal, /updateRrpApplicationDraft/);
    assert.match(modal, /submitRrpApplication/);
    assert.match(modal, /withdrawRrpApplication/);
    assert.match(modal, /expectedRevision: active\.revision/);
    assert.doesNotMatch(modal, /localStorage/);
    assert.doesNotMatch(api, /localStorage/);
  });

  it("supports multiple representation countries and duplicate-active messaging", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(modal, /duplicateActive/);
    assert.match(modal, /activeApplications\.find/);
    assert.match(modal, /hub\.historyHeading/);
    assert.match(modal, /hub\.newHeading/);
  });

  it("surfaces revision conflicts and index-unavailable errors", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(modal, /status === 409/);
    assert.match(modal, /status === 503/);
    assert.match(modal, /errors\.conflict/);
    assert.match(modal, /errors\.unavailable/);
  });

  it("shows post-submit messaging without claiming admin notification delivery", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(modal, /messages\.notAppointment/);
    assert.match(modal, /messages\.fundingNotCommitment/);
    assert.match(modal, /messages\.moreInfoPossible/);
    assert.match(modal, /messages\.messagesLater/);
    assert.doesNotMatch(modal, /admin notification (was|has been) (sent|delivered)/i);
  });

  it("requires explicit unchecked consent and links the published privacy policy", () => {
    assert.equal(EMPTY_RRP_APPLICATION_FORM.consentAccepted, false);
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(modal, /href="\/privacy"/);
    assert.match(modal, /consentAccepted/);
    assert.match(modal, /RRP_APPLICATION_CONSENT_VERSION/);
    assert.equal(RRP_APPLICATION_CONSENT_VERSION, "rrp-application-consent-v2");
    assert.equal(
      validateRrpApplicationFormForSubmit({
        ...EMPTY_RRP_APPLICATION_FORM,
        legalFirstName: "A",
        legalLastName: "B",
        profession: "C",
        residenceCountryCode: "CA",
        representCountryCode: "UA",
        dateOfBirth: "2000-01-01",
        fundingModel: "SELF",
        teamMemberCount: "0",
        relevantExperience: "exp",
        motivation: "mot",
        consentAccepted: false,
      }),
      "consent",
    );
  });

  it("keeps DOB out of URLs, analytics, and browser storage APIs", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    const api = read("features/regional-program/rrp-application-api.ts");
    assert.doesNotMatch(modal, /localStorage|sessionStorage|analytics|gtag|dataLayer/);
    assert.doesNotMatch(api, /localStorage|sessionStorage/);
    assert.doesNotMatch(modal, /router\.(push|replace).*dateOfBirth/);
    assert.doesNotMatch(modal, /console\.(log|info|debug).*dateOfBirth/);
  });

  it("uses next-intl rrpApplication catalog keys without hardcoded English titles", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    const en = JSON.parse(read("features/i18n/messages/en.json"));
    assert.match(modal, /useTranslations\("rrpApplication"\)/);
    assert.equal(typeof en.rrpApplication.title, "string");
    assert.equal(typeof en.rrpApplication.consent.label, "string");
    assert.match(en.rrpApplication.consent.label, /<privacy>/);
    for (const locale of ["ar", "uk", "zh-Hant"] as const) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`));
      assert.equal(typeof catalog.rrpApplication?.title, "string");
    }
  });

  it("does not enable the RRP entry flag in source", () => {
    assert.equal(
      isRrpApplicationEntryEnabled({ [RRP_APPLICATION_ENTRY_FLAG_ENV]: "true" }),
      true,
    );
    assert.equal(isRrpApplicationEntryEnabled({}), false);
    const entry = read("features/regional-program/rrp-application-entry.ts");
    assert.match(entry, /=== "true"/);
  });

  it("marks every invalid submit field and drops the mark when that field is corrected", () => {
    const invalid = {
      ...EMPTY_RRP_APPLICATION_FORM,
      representCountryCode: " ",
      motivation: "  ",
      consentAccepted: false,
      dateOfBirth: "2099-01-01",
      fundingModel: "FULL" as const,
      annualRequestedAmountCad: "0",
      teamMemberCount: "-1",
    };
    assert.deepEqual(listRrpApplicationSubmitIssues(invalid), [
      "representCountry",
      "motivation",
      "consent",
      "dateOfBirth",
      "annualAmount",
      "teamMemberCount",
    ]);
    assert.equal(validateRrpApplicationFormForSubmit(invalid), "representCountry");

    const correctedCountry = { ...invalid, representCountryCode: "CA" };
    assert.equal(listRrpApplicationSubmitIssues(correctedCountry).includes("representCountry"), false);

    const corrected = {
      ...correctedCountry,
      motivation: "Coordinate regional civic work",
      consentAccepted: true,
      dateOfBirth: "",
      fundingModel: "SELF" as const,
      annualRequestedAmountCad: "",
      teamMemberCount: "0",
    };
    assert.deepEqual(listRrpApplicationSubmitIssues(corrected), []);
    assert.equal(validateRrpApplicationFormForSubmit(corrected), null);
  });

  it("highlights invalid fields in the modal and leaves save draft available", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    const css = read("features/regional-program/components/rrp-application-modal.css");
    assert.match(modal, /listRrpApplicationSubmitIssues/);
    assert.match(modal, /validateRrpApplicationFormForSubmit\(form\)/);
    assert.match(modal, /aria-invalid=\{motivationMessage \? true : undefined\}/);
    assert.match(modal, /aria-invalid=\{consentMessage \? true : undefined\}/);
    assert.match(modal, /aria-invalid=\{dateOfBirthMessage \? true : undefined\}/);
    assert.match(modal, /aria-invalid=\{annualAmountMessage \? true : undefined\}/);
    assert.match(modal, /aria-invalid=\{teamMemberCountMessage \? true : undefined\}/);
    assert.match(modal, /rrp-application-modal__field-error/);
    assert.match(modal, /t\(`validation\.\$\{issue\}`\)/);
    assert.doesNotMatch(modal, /Motivation \/ proposed activity is required/);
    assert.match(modal, /disabled=\{busy !== null \|\| submitIssues\.length > 0\}/);
    assert.match(modal, /rrp-application-modal__submit-blocked/);
    assert.match(modal, /submitIssues\.map\(\(issue\) =>/);
    const submitLabel = modal.indexOf('t("actions.submit")');
    const blockedAt = modal.lastIndexOf("rrp-application-modal__submit-blocked", submitLabel);
    assert.ok(blockedAt >= 0 && blockedAt < submitLabel);

    const saveLabel = modal.indexOf('t("actions.saveDraft")');
    const saveRegion = modal.slice(Math.max(0, saveLabel - 280), saveLabel);
    assert.match(saveRegion, /disabled=\{busy !== null\}/);
    assert.doesNotMatch(saveRegion, /submitIssues/);

    assert.match(css, /\[aria-invalid="true"\]/);
    assert.match(css, /--hu-color-danger/);
    assert.match(css, /text-align:\s*start/);
    assert.match(css, /\[dir="rtl"\]/);

    for (const locale of ["en", "ar", "uk", "zh-Hant", "de", "es", "fr", "he", "ka", "pt"] as const) {
      const catalog = JSON.parse(read(`features/i18n/messages/${locale}.json`));
      const message =
        catalog.rrpApplication?.validation?.motivation ??
        JSON.parse(read("features/i18n/messages/en.json")).rrpApplication.validation.motivation;
      assert.equal(typeof message, "string");
      assert.ok(message.length > 0);
    }
  });

  it("supports opening a selected applicationId and notifying external refresh", () => {
    const modal = read("features/regional-program/components/RrpApplicationModal.tsx");
    assert.match(modal, /initialApplicationId\?:/);
    assert.match(modal, /onApplicationsChanged\?:/);
    assert.match(modal, /item\.applicationId === initialApplicationId/);
    assert.match(modal, /errors\.notFound/);
    assert.match(modal, /onApplicationsChangedRef\.current\?\.\(\)/);
  });
});

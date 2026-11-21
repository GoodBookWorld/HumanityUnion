/**
 * HU-RRP-07G.2 — packaged catalogs must not publish retired RRP requirements.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = path.resolve(webRoot, "../..");
const packagedDir = path.join(repoRoot, "apps/api/assets/packaged-web-ui-catalogs");

const LOCALES = ["en", "uk", "zh-Hant", "ar", "de", "es", "fr", "he", "ka", "pt"] as const;

const RULE_KEYS = [
  "rrpApplication.form.displayNameHint",
  "rrpApplication.fields.legalFirstName",
  "rrpApplication.fields.legalLastName",
  "rrpApplication.fields.profession",
  "rrpApplication.fields.residenceCountry",
  "rrpApplication.fields.representCountry",
  "rrpApplication.fields.representCountryHelp",
  "rrpApplication.fields.dateOfBirth",
  "rrpApplication.fields.dateOfBirthHelp",
  "rrpApplication.fields.fundingModel",
  "rrpApplication.fields.teamMemberCount",
  "rrpApplication.fields.relevantExperience",
  "rrpApplication.fields.motivation",
  "rrpApplication.validation.representCountry",
  "rrpApplication.validation.legalFirstName",
  "rrpApplication.validation.legalLastName",
  "rrpApplication.validation.profession",
  "rrpApplication.validation.residenceCountry",
  "rrpApplication.validation.dateOfBirth",
  "rrpApplication.validation.fundingModel",
  "rrpApplication.validation.annualAmount",
  "rrpApplication.validation.teamMemberCount",
  "rrpApplication.validation.relevantExperience",
  "rrpApplication.validation.motivation",
  "rrpApplication.admin.fields.applicant",
] as const;

const OBSOLETE_CLAIMS = [
  "Applicants must be at least 18",
  "at least 18 years old",
  "Legal first name is required.",
  "Legal last name is required.",
  "Profession is required.",
  "Residence country is required.",
  "Relevant experience is required.",
  "Select a funding model.",
  "Country to represent",
  "Applicant identity",
] as const;

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function leaves(node: unknown, prefix = "", out: Map<string, string> = new Map()): Map<string, string> {
  if (typeof node === "string") {
    if (prefix) out.set(prefix, node);
    return out;
  }
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      leaves(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
  return out;
}

describe("HU-RRP-07G.2 packaged RRP requirement safety", () => {
  it("keeps packaged English application rules aligned with the web source", () => {
    const web = leaves(readJson(path.join(webRoot, "src/features/i18n/messages/en.json")));
    const packaged = leaves(readJson(path.join(packagedDir, "en.json")));
    for (const key of RULE_KEYS) {
      assert.equal(packaged.get(key), web.get(key), key);
    }
    assert.match(packaged.get("rrpApplication.validation.consent") ?? "", /required/i);
    assert.match(packaged.get("rrpApplication.validation.motivation") ?? "", /required/i);
    assert.match(packaged.get("rrpApplication.fields.representCountryHelp") ?? "", /^Required\./);
    assert.equal(packaged.get("rrpApplication.admin.fields.fundingModel"), "Funding model");
  });

  it("rejects retired age and required-field claims in every packaged locale", () => {
    const files = readdirSync(packagedDir).filter((name) => name.endsWith(".json"));
    assert.deepEqual(
      files.map((name) => name.replace(/\.json$/, "")).sort(),
      [...LOCALES].sort(),
    );
    for (const locale of LOCALES) {
      const catalog = leaves(readJson(path.join(packagedDir, `${locale}.json`)));
      for (const [key, value] of catalog) {
        if (!key.startsWith("rrpApplication.")) continue;
        for (const claim of OBSOLETE_CLAIMS) {
          assert.equal(
            value.includes(claim),
            false,
            `${locale} ${key} still contains ${JSON.stringify(claim)}`,
          );
        }
      }
    }
  });

  it("keeps an existing non-English delivery warning instead of replacing it with English", () => {
    const web = leaves(readJson(path.join(webRoot, "src/features/i18n/messages/de.json")));
    const packaged = leaves(readJson(path.join(packagedDir, "de.json")));
    const english = leaves(readJson(path.join(webRoot, "src/features/i18n/messages/en.json")));
    const key = "rrpApplication.admin.messages.deliveryPendingRetry";
    assert.equal(packaged.get(key), web.get(key));
    assert.notEqual(packaged.get(key), english.get(key));
  });
});

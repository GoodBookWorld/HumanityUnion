/**
 * HU-RRP-07G.3 — participant Regional Representative application catalogs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = path.resolve(webRoot, "../..");
const webDir = path.join(webRoot, "src/features/i18n/messages");
const packagedDir = path.join(repoRoot, "apps/api/assets/packaged-web-ui-catalogs");

const LOCALES = ["en", "uk", "zh-Hant", "ar", "de", "es", "fr", "he", "ka", "pt"] as const;

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

const ENUM_KEYS = [
  "rrpApplication.funding.UNSPECIFIED",
  "rrpApplication.funding.SELF",
  "rrpApplication.funding.PARTIAL",
  "rrpApplication.funding.FULL",
  "rrpApplication.status.draft",
  "rrpApplication.status.submitted",
  "rrpApplication.status.under_review",
  "rrpApplication.status.information_requested",
  "rrpApplication.status.approved",
  "rrpApplication.status.rejected",
  "rrpApplication.status.withdrawn",
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

function tokens(value: string): string {
  return [...value.matchAll(/\{[A-Za-z_][A-Za-z0-9_]*\}/g)].map((match) => match[0]).join("|");
}

function tags(value: string): string {
  return [...value.matchAll(/<\/?[A-Za-z0-9]+>/g)].map((match) => match[0]).join("|");
}

function participantLeaves(catalog: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of catalog) {
    if (key.startsWith("rrpApplication.") && !key.startsWith("rrpApplication.admin.")) {
      out.set(key, value);
    }
  }
  return out;
}

describe("HU-RRP-07G.3 participant application localization", () => {
  const english = participantLeaves(leaves(readJson(path.join(webDir, "en.json"))));

  it("covers every participant key in each installed locale", () => {
    assert.equal(english.size, 103);
    for (const locale of LOCALES) {
      for (const dir of [webDir, packagedDir]) {
        const catalog = participantLeaves(leaves(readJson(path.join(dir, `${locale}.json`))));
        assert.deepEqual([...catalog.keys()], [...english.keys()], `${locale} ${dir}`);
        for (const [key, value] of catalog) {
          assert.equal(value.trim().length > 0, true, `${locale} ${key}`);
        }
      }
    }
  });

  it("keeps placeholders, rich tags, and packaged copies aligned", () => {
    for (const locale of LOCALES) {
      const web = participantLeaves(leaves(readJson(path.join(webDir, `${locale}.json`))));
      const packaged = participantLeaves(leaves(readJson(path.join(packagedDir, `${locale}.json`))));
      for (const [key, source] of english) {
        const value = web.get(key);
        assert.ok(value, key);
        assert.equal(tokens(value), tokens(source), `${locale} ${key}`);
        assert.equal(tags(value), tags(source), `${locale} ${key}`);
        assert.equal(packaged.get(key), value, `${locale} ${key}`);
        if (locale !== "en") {
          assert.notEqual(value, source, `${locale} ${key}`);
        }
      }
    }
  });

  it("does not publish obsolete required-field or minimum-age claims", () => {
    for (const locale of LOCALES) {
      const catalog = participantLeaves(leaves(readJson(path.join(webDir, `${locale}.json`))));
      for (const [key, value] of catalog) {
        assert.equal(/\b18\b/.test(value), false, `${locale} ${key}`);
        for (const claim of OBSOLETE_CLAIMS) {
          assert.equal(value.includes(claim), false, `${locale} ${key} ${claim}`);
        }
      }
      const annual = catalog.get("rrpApplication.validation.annualAmount");
      assert.ok(annual);
      assert.match(annual, /PARTIAL/);
      assert.match(annual, /FULL/);
      assert.match(annual, /CAD/);
      for (const key of ENUM_KEYS) {
        assert.equal(catalog.has(key), true, `${locale} ${key}`);
      }
    }

    assert.match(english.get("rrpApplication.fields.representCountryHelp") ?? "", /^Required\./);
    assert.match(english.get("rrpApplication.fields.dateOfBirthHelp") ?? "", /not required/i);
    assert.match(english.get("rrpApplication.validation.motivation") ?? "", /required/i);
    assert.match(english.get("rrpApplication.validation.consent") ?? "", /required/i);
    for (const key of [
      "rrpApplication.fields.legalFirstName",
      "rrpApplication.fields.legalLastName",
      "rrpApplication.fields.profession",
      "rrpApplication.fields.residenceCountry",
      "rrpApplication.fields.dateOfBirth",
      "rrpApplication.fields.relevantExperience",
      "rrpApplication.fields.fundingModel",
    ]) {
      assert.match(english.get(key) ?? "", /optional/i, key);
    }
  });
});

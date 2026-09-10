/**
 * Closure 07 — regression helper: detect hardcoded locale eligibility policy
 * in localization engine modules (Closures 05–07 surfaces).
 *
 * Does not ban catalog fixtures, seed data, or tests.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const HARDCODED_LOCALE_TRIPLE =
  /\[\s*["']uk["']\s*,\s*["'](?:ar|zh-Hant)["']\s*,\s*["'](?:ar|zh-Hant)["']\s*\]/;

const LOCALE_IDENT = "(?:locale|targetLocale|language)";
const LOCALE_SWITCH_ELIGIBILITY = new RegExp(
  String.raw`switch\s*\(\s*${LOCALE_IDENT}\s*\)`,
);
const LOCALE_EQ_BRANCH = new RegExp(
  String.raw`if\s*\(\s*${LOCALE_IDENT}\s*===?\s*["'](?:uk|ar|zh-Hant)["']`,
);

export type HardcodedLocaleEligibilityFinding = {
  readonly file: string;
  readonly kind: "locale_triple" | "locale_switch" | "locale_eq_branch";
  readonly excerpt: string;
};

function walkFiles(dir: string, out: string[] = []): string[] {
  let st;
  try {
    st = statSync(dir);
  } catch {
    return out;
  }
  if (st.isFile()) {
    if (/\.(ts|tsx|js)$/.test(dir) && !dir.includes(".test.") && !dir.includes(".spec.")) {
      out.push(dir);
    }
    return out;
  }
  if (!st.isDirectory()) {
    return out;
  }
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const entrySt = statSync(full);
    if (entrySt.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "test" || entry === "__tests__") {
        continue;
      }
      walkFiles(full, out);
    } else if (
      /\.(ts|tsx|js)$/.test(entry) &&
      !entry.includes(".test.") &&
      !entry.includes(".spec.")
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan Closure 05–07 engine modules for hardcoded locale eligibility policy.
 */
export function findHardcodedLocaleEligibilityPolicy(input: {
  readonly roots: readonly string[];
}): readonly HardcodedLocaleEligibilityFinding[] {
  const findings: HardcodedLocaleEligibilityFinding[] = [];
  for (const root of input.roots) {
    let files: string[] = [];
    try {
      files = walkFiles(root);
    } catch {
      continue;
    }
    for (const file of files) {
      if (file.includes("assert-no-hardcoded-locale-eligibility")) {
        continue;
      }
      const src = readFileSync(file, "utf8");
      if (HARDCODED_LOCALE_TRIPLE.test(src)) {
        findings.push({
          file,
          kind: "locale_triple",
          excerpt: "hardcoded locale triple allowlist",
        });
      }
      if (LOCALE_SWITCH_ELIGIBILITY.test(src)) {
        findings.push({
          file,
          kind: "locale_switch",
          excerpt: "locale switch eligibility branch",
        });
      }
      if (LOCALE_EQ_BRANCH.test(src)) {
        findings.push({
          file,
          kind: "locale_eq_branch",
          excerpt: "locale equality eligibility branch",
        });
      }
    }
  }
  return findings;
}

export function assertNoHardcodedLocaleEligibilityPolicy(input: {
  readonly roots: readonly string[];
}): void {
  const findings = findHardcodedLocaleEligibilityPolicy(input);
  if (findings.length === 0) return;
  const detail = findings
    .map((row) => `${row.kind}:${path.basename(row.file)}:${row.excerpt}`)
    .join("; ");
  throw new Error(`HARDCODED_LOCALE_ELIGIBILITY_POLICY: ${detail}`);
}

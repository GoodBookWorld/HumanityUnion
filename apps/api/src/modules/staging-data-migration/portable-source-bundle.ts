import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  APPROVED_HISTORICAL_INITIATIVES,
  AUTH_SECRET_FIELDS,
  EXPECTED_TARGET_HISTORICAL_INITIATIVE_COUNT,
  PORTABLE_CIVIC_SOURCE_RELATIVE_PATH,
} from "./constants.js";
import { StagingDataMigrationError } from "./guards.js";
import type { InitiativeRecord } from "./types.js";

export { PORTABLE_CIVIC_SOURCE_RELATIVE_PATH };

export const PORTABLE_BUNDLE_FILES = [
  "initiatives.json",
  "initiative-analyses.json",
  "initiative-improvement-proposals.json",
  "initiative-revisions.json",
  "initiative-petition-drafts.json",
] as const;

export interface PortableCivicSourceManifest {
  bundleVersion: string;
  pack: string;
  generatedAt: string;
  sourceLogicalOrigin: string;
  approvedInitiativeIds: string[];
  artifactCounts: {
    initiatives: number;
    analyses: number;
    improvementProposals: number;
    revisions: number;
    petitionDrafts: number;
  };
  files: string[];
  fileChecksumsSha256: Record<string, string>;
  bundleChecksumSha256: string;
  legacyExcluded: string[];
  secretScan?: { result?: string };
}

export interface LoadedPortableCivicSource {
  bundleDir: string;
  manifest: PortableCivicSourceManifest;
  initiativesById: Map<string, InitiativeRecord>;
  analyses: Record<string, unknown>[];
  proposals: Record<string, unknown>[];
  revisions: Record<string, unknown>[];
  petitionDrafts: Record<string, unknown>[];
  relatedCountsByInitiativeId: Map<
    string,
    { analyses: number; proposals: number; revisions: number; petitionDrafts: number }
  >;
}

const SECRET_KEY_PATTERN =
  /password|token|secret|session|hash|jwt|refresh|credential|mongodb(\+srv)?:\/\//i;

function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function computeFileChecksums(bundleDir: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const fileName of PORTABLE_BUNDLE_FILES) {
    const fullPath = path.join(bundleDir, fileName);
    if (!fs.existsSync(fullPath)) {
      throw new StagingDataMigrationError(
        `Portable civic source missing required file: ${fileName}`,
      );
    }
    hashes[fileName] = sha256Text(fs.readFileSync(fullPath, "utf8"));
  }
  return hashes;
}

export function computeBundleChecksum(fileChecksums: Record<string, string>): string {
  const material =
    Object.keys(fileChecksums)
      .sort()
      .map((key) => `${key}:${fileChecksums[key]}`)
      .join("\n") + "\n";
  return sha256Text(material);
}

function loadSnapshotMap(
  filePath: string,
  mapKey: string,
): Record<string, Record<string, unknown>> {
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const map = parsed[mapKey];
  if (!map || typeof map !== "object" || Array.isArray(map)) {
    throw new StagingDataMigrationError(
      `Portable civic source file ${path.basename(filePath)} missing map key "${mapKey}".`,
    );
  }
  return map as Record<string, Record<string, unknown>>;
}

function scanForSecrets(value: unknown, trail: string, findings: string[]): void {
  if (value == null) {
    return;
  }
  if (typeof value === "string") {
    if (/mongodb(\+srv)?:\/\//i.test(value)) {
      findings.push(`${trail}: connection-string-like value`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanForSecrets(entry, `${trail}[${index}]`, findings));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (
        SECRET_KEY_PATTERN.test(key) ||
        (AUTH_SECRET_FIELDS as readonly string[]).includes(key)
      ) {
        findings.push(`${trail}.${key}`);
        continue;
      }
      scanForSecrets(nested, `${trail}.${key}`, findings);
    }
  }
}

export function resolvePortableCivicSourceDir(
  repoRoot: string,
  overrideDir?: string,
): string {
  if (overrideDir?.trim()) {
    return path.resolve(overrideDir.trim());
  }
  return path.join(repoRoot, PORTABLE_CIVIC_SOURCE_RELATIVE_PATH);
}

/**
 * Load and validate the version-controlled Pack 02A civic source bundle.
 * Does not read apps/api/.runtime.
 */
export function loadAndValidatePortableCivicSource(bundleDir: string): LoadedPortableCivicSource {
  const manifestPath = path.join(bundleDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new StagingDataMigrationError(
      `Portable civic source bundle missing at ${PORTABLE_CIVIC_SOURCE_RELATIVE_PATH} (manifest.json not found).`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PortableCivicSourceManifest;
  if (manifest.pack !== "STAGING_DATA_MIGRATION_PACK_02A") {
    throw new StagingDataMigrationError("Portable civic source manifest pack marker invalid.");
  }

  const actualChecksums = computeFileChecksums(bundleDir);
  for (const fileName of PORTABLE_BUNDLE_FILES) {
    const expected = manifest.fileChecksumsSha256?.[fileName];
    if (!expected || expected !== actualChecksums[fileName]) {
      throw new StagingDataMigrationError(
        `Portable civic source checksum mismatch for ${fileName}.`,
      );
    }
  }

  const actualBundleChecksum = computeBundleChecksum(actualChecksums);
  if (actualBundleChecksum !== manifest.bundleChecksumSha256) {
    throw new StagingDataMigrationError(
      "Portable civic source bundleChecksumSha256 mismatch (tamper or drift).",
    );
  }

  const initiativesMap = loadSnapshotMap(path.join(bundleDir, "initiatives.json"), "initiatives");
  const initiativeIds = Object.keys(initiativesMap);
  if (initiativeIds.length !== EXPECTED_TARGET_HISTORICAL_INITIATIVE_COUNT) {
    throw new StagingDataMigrationError(
      `Portable civic source must contain exactly ${EXPECTED_TARGET_HISTORICAL_INITIATIVE_COUNT} Initiatives (found ${initiativeIds.length}).`,
    );
  }

  const approvedIds = new Set<string>(
    APPROVED_HISTORICAL_INITIATIVES.map((item) => item.initiativeId),
  );
  for (const id of initiativeIds) {
    if (!approvedIds.has(id)) {
      throw new StagingDataMigrationError(
        `Unexpected Initiative ID in portable civic source: ${id}`,
      );
    }
  }
  for (const approved of APPROVED_HISTORICAL_INITIATIVES) {
    const record = initiativesMap[approved.initiativeId];
    if (!record) {
      throw new StagingDataMigrationError(
        `Approved Initiative missing from portable civic source: ${approved.initiativeId}`,
      );
    }
    if (String(record.stewardId) !== approved.stewardMemberId) {
      throw new StagingDataMigrationError(
        `Steward mapping missing/incorrect for ${approved.initiativeId}.`,
      );
    }
  }

  if (!initiativeIds.includes("initiative-1785948978037")) {
    throw new StagingDataMigrationError("Isabella Initiative missing from portable civic source.");
  }

  const analysesMap = loadSnapshotMap(
    path.join(bundleDir, "initiative-analyses.json"),
    "analyses",
  );
  const proposalsMap = loadSnapshotMap(
    path.join(bundleDir, "initiative-improvement-proposals.json"),
    "proposals",
  );
  const revisionsMap = loadSnapshotMap(
    path.join(bundleDir, "initiative-revisions.json"),
    "revisions",
  );
  const draftsMap = loadSnapshotMap(
    path.join(bundleDir, "initiative-petition-drafts.json"),
    "drafts",
  );

  const childMaps: Array<{ name: string; map: Record<string, Record<string, unknown>> }> = [
    { name: "analyses", map: analysesMap },
    { name: "proposals", map: proposalsMap },
    { name: "revisions", map: revisionsMap },
    { name: "petitionDrafts", map: draftsMap },
  ];

  const seenChildIds = new Set<string>();
  for (const { name, map } of childMaps) {
    for (const [childId, record] of Object.entries(map)) {
      const initiativeId = String(record.initiativeId ?? "");
      if (!approvedIds.has(initiativeId)) {
        throw new StagingDataMigrationError(
          `Orphan/unauthorized ${name} artifact ${childId} references Initiative ${initiativeId}.`,
        );
      }
      if (seenChildIds.has(`${name}:${childId}`)) {
        throw new StagingDataMigrationError(`Duplicate ${name} artifact id ${childId}.`);
      }
      seenChildIds.add(`${name}:${childId}`);
    }
  }

  const secretFindings: string[] = [];
  scanForSecrets(initiativesMap, "initiatives", secretFindings);
  scanForSecrets(analysesMap, "analyses", secretFindings);
  scanForSecrets(proposalsMap, "proposals", secretFindings);
  scanForSecrets(revisionsMap, "revisions", secretFindings);
  scanForSecrets(draftsMap, "petitionDrafts", secretFindings);
  if (secretFindings.length > 0) {
    throw new StagingDataMigrationError(
      `Portable civic source failed secret scan (${secretFindings.length} finding(s)).`,
    );
  }

  for (const legacy of ["activities", "discussions", "proposals", "decisions"]) {
    if (fs.existsSync(path.join(bundleDir, `${legacy}.json`))) {
      throw new StagingDataMigrationError(
        `Portable civic source must not include legacy root file ${legacy}.json.`,
      );
    }
  }

  const initiativesById = new Map<string, InitiativeRecord>();
  for (const [id, record] of Object.entries(initiativesMap)) {
    initiativesById.set(id, {
      ...(record as InitiativeRecord),
      initiativeId: String(record.initiativeId ?? id),
      title: String(record.title ?? ""),
      stewardId: String(record.stewardId ?? ""),
    });
  }

  const relatedCountsByInitiativeId = new Map<
    string,
    { analyses: number; proposals: number; revisions: number; petitionDrafts: number }
  >();
  for (const id of approvedIds) {
    relatedCountsByInitiativeId.set(id, {
      analyses: 0,
      proposals: 0,
      revisions: 0,
      petitionDrafts: 0,
    });
  }
  for (const record of Object.values(analysesMap)) {
    const id = String(record.initiativeId);
    const counts = relatedCountsByInitiativeId.get(id)!;
    counts.analyses += 1;
  }
  for (const record of Object.values(proposalsMap)) {
    const id = String(record.initiativeId);
    const counts = relatedCountsByInitiativeId.get(id)!;
    counts.proposals += 1;
  }
  for (const record of Object.values(revisionsMap)) {
    const id = String(record.initiativeId);
    const counts = relatedCountsByInitiativeId.get(id)!;
    counts.revisions += 1;
  }
  for (const record of Object.values(draftsMap)) {
    const id = String(record.initiativeId);
    const counts = relatedCountsByInitiativeId.get(id)!;
    counts.petitionDrafts += 1;
  }

  const expectedCounts = manifest.artifactCounts;
  if (
    expectedCounts.initiatives !== initiativesById.size ||
    expectedCounts.analyses !== Object.keys(analysesMap).length ||
    expectedCounts.improvementProposals !== Object.keys(proposalsMap).length ||
    expectedCounts.revisions !== Object.keys(revisionsMap).length ||
    expectedCounts.petitionDrafts !== Object.keys(draftsMap).length
  ) {
    throw new StagingDataMigrationError(
      "Portable civic source artifactCounts in manifest do not match file contents.",
    );
  }

  return {
    bundleDir,
    manifest,
    initiativesById,
    analyses: Object.values(analysesMap),
    proposals: Object.values(proposalsMap),
    revisions: Object.values(revisionsMap),
    petitionDrafts: Object.values(draftsMap),
    relatedCountsByInitiativeId,
  };
}

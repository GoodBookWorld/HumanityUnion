import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PORTABLE_MEDIA_SOURCE_RELATIVE_PATH } from "./constants.js";
import { StagingHistoricalMediaError } from "./guards.js";

export interface PortableMediaInitiativeCover {
  initiativeId: string;
  title: string;
  sourceFilename: string;
  bundleRelativePath: string;
  contentType: string;
  byteLength: number;
  contentSha256: string;
  historicalLocalhostUrl: string;
  destinationObjectKey: string;
  status: string;
}

export interface PortableMediaAvatar {
  key: string;
  memberId: string;
  userId: string;
  displayName: string;
  sourceFilename: string;
  bundleRelativePath: string;
  contentType: string;
  byteLength: number;
  contentSha256: string;
  historicalLocalhostUrl: string;
  destinationObjectKey: string;
  status: string;
}

export interface PortableMediaManifest {
  bundleVersion: string;
  pack: string;
  generatedAt: string;
  totalFiles: number;
  totalBytes: number;
  initiativeCovers: PortableMediaInitiativeCover[];
  participantAvatars: PortableMediaAvatar[];
  unresolvedAvatars: unknown[];
  fileChecksumsSha256: Record<string, string>;
  bundleChecksumSha256: string;
  excluded?: Record<string, boolean>;
}

export interface LoadedPortableMediaSource {
  bundleDir: string;
  manifest: PortableMediaManifest;
}

function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function computeBundleChecksum(fileChecksums: Record<string, string>): string {
  const material =
    Object.keys(fileChecksums)
      .sort()
      .map((key) => `${key}:${fileChecksums[key]}`)
      .join("\n") + "\n";
  return createHash("sha256").update(material).digest("hex");
}

export function resolvePortableMediaSourceDir(
  repoRoot: string,
  overrideDir?: string,
): string {
  if (overrideDir?.trim()) {
    return path.resolve(overrideDir.trim());
  }
  return path.join(repoRoot, PORTABLE_MEDIA_SOURCE_RELATIVE_PATH);
}

export function loadAndValidatePortableMediaSource(bundleDir: string): LoadedPortableMediaSource {
  const manifestPath = path.join(bundleDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new StagingHistoricalMediaError(
      `Portable media source missing (${PORTABLE_MEDIA_SOURCE_RELATIVE_PATH}/manifest.json).`,
    );
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PortableMediaManifest;
  if (manifest.pack !== "STAGING_DATA_MIGRATION_PACK_03") {
    throw new StagingHistoricalMediaError("Portable media manifest pack marker invalid.");
  }

  if (manifest.initiativeCovers?.length !== 5) {
    throw new StagingHistoricalMediaError(
      `Portable media bundle must contain exactly 5 Initiative covers (found ${manifest.initiativeCovers?.length ?? 0}).`,
    );
  }

  const actualChecksums: Record<string, string> = {};
  for (const entry of [...manifest.initiativeCovers, ...manifest.participantAvatars]) {
    const fullPath = path.join(bundleDir, entry.bundleRelativePath);
    if (!fs.existsSync(fullPath)) {
      throw new StagingHistoricalMediaError(
        `Portable media file missing: ${entry.bundleRelativePath}`,
      );
    }
    const buffer = fs.readFileSync(fullPath);
    const sha = sha256Buffer(buffer);
    if (sha !== entry.contentSha256) {
      throw new StagingHistoricalMediaError(
        `Checksum mismatch for ${entry.bundleRelativePath}.`,
      );
    }
    actualChecksums[entry.bundleRelativePath] = sha;
  }

  const expectedKeys = Object.keys(manifest.fileChecksumsSha256 ?? {}).sort();
  const actualKeys = Object.keys(actualChecksums).sort();
  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
    throw new StagingHistoricalMediaError("Portable media manifest file list mismatch.");
  }
  for (const key of expectedKeys) {
    if (manifest.fileChecksumsSha256[key] !== actualChecksums[key]) {
      throw new StagingHistoricalMediaError(`Checksum mismatch for ${key}.`);
    }
  }

  const bundleChecksum = computeBundleChecksum(actualChecksums);
  if (bundleChecksum !== manifest.bundleChecksumSha256) {
    throw new StagingHistoricalMediaError(
      "Portable media bundleChecksumSha256 mismatch (tamper or drift).",
    );
  }

  const initiativeIds = new Set(manifest.initiativeCovers.map((item) => item.initiativeId));
  if (initiativeIds.size !== 5) {
    throw new StagingHistoricalMediaError("Duplicate Initiative IDs in media bundle.");
  }
  if (!initiativeIds.has("initiative-1785948978037")) {
    throw new StagingHistoricalMediaError("Isabella Initiative cover missing from media bundle.");
  }

  return { bundleDir, manifest };
}

export function readBundleFile(bundleDir: string, relativePath: string): Buffer {
  const fullPath = path.join(bundleDir, relativePath);
  return fs.readFileSync(fullPath);
}

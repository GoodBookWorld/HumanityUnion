/**
 * Validate remote WEB_UI message trees against bundled English foundation paths.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { WebUiMessagePackValidationReport, WebUiMessageTree } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const ENGLISH_MESSAGES_PATH = path.resolve(
  here,
  "../../../../web/src/features/i18n/messages/en.json",
);

type MessagePack = Record<string, unknown>;

let englishPathSet: ReadonlySet<string> | null = null;

function collectStringPaths(messages: MessagePack, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(messages)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      paths.push(pathKey);
      continue;
    }
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...collectStringPaths(value as MessagePack, pathKey));
    }
  }
  return paths;
}

export function loadBundledEnglishWebUiMessagePack(): MessagePack {
  return JSON.parse(readFileSync(ENGLISH_MESSAGES_PATH, "utf8")) as MessagePack;
}

export function loadBundledWebUiMessagePackFromFs(locale: string): MessagePack | null {
  try {
    const filePath = path.resolve(
      here,
      `../../../../web/src/features/i18n/messages/${locale}.json`,
    );
    return JSON.parse(readFileSync(filePath, "utf8")) as MessagePack;
  } catch {
    return null;
  }
}

function englishFoundationPaths(): ReadonlySet<string> {
  if (englishPathSet) {
    return englishPathSet;
  }
  englishPathSet = new Set(collectStringPaths(loadBundledEnglishWebUiMessagePack()));
  return englishPathSet;
}

/** Test-only — clear cached English path set after fixture mutation. */
export function resetEnglishWebUiPathCacheForTests(): void {
  englishPathSet = null;
}

export function validateWebUiMessageTreeAgainstEnglish(
  messages: WebUiMessageTree,
): WebUiMessagePackValidationReport {
  if (messages == null || typeof messages !== "object" || Array.isArray(messages)) {
    return {
      acceptedKeyCount: 0,
      rejectedUnknownPaths: ["(messages root must be an object)"],
      rejectedNonStringPaths: [],
    };
  }

  const allowed = englishFoundationPaths();
  const rejectedUnknownPaths: string[] = [];
  const rejectedNonStringPaths: string[] = [];
  let acceptedKeyCount = 0;

  function walk(node: unknown, prefix: string): void {
    if (typeof node === "string") {
      if (!allowed.has(prefix)) {
        rejectedUnknownPaths.push(prefix);
        return;
      }
      acceptedKeyCount += 1;
      return;
    }
    if (node != null && typeof node === "object" && !Array.isArray(node)) {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        const pathKey = prefix ? `${prefix}.${key}` : key;
        walk(value, pathKey);
      }
      return;
    }
    rejectedNonStringPaths.push(prefix || "(root)");
  }

  walk(messages, "");
  return {
    acceptedKeyCount,
    rejectedUnknownPaths,
    rejectedNonStringPaths,
  };
}

export { collectStringPaths };

/**
 * Validate remote WEB_UI message trees against bundled English foundation paths.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isParticipantWebUiRequiredPath,
  isPublicReaderWebUiRequiredPath,
  type WebUiMessagePackPreparationScope,
  type WebUiMessagePackValidationReport,
  type WebUiMessageTree,
} from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const ENGLISH_MESSAGES_PATH = path.resolve(
  here,
  "../../../../web/src/features/i18n/messages/en.json",
);

type MessagePack = Record<string, unknown>;

let englishPathSet: ReadonlySet<string> | null = null;
let englishValueMap: ReadonlyMap<string, string> | null = null;

const MESSAGE_ARGUMENT = /^[A-Za-z_][A-Za-z0-9_]*/;

export interface MessageStructureInspection {
  readonly placeholders: readonly string[];
  readonly richTags: readonly string[];
  readonly balanced: boolean;
}

/**
 * Top-level next-intl arguments only.
 * Words inside an ICU branch, such as `{count, plural, =0 {No proposals}}`, are not variables.
 */
export function inspectMessageStructure(value: string): MessageStructureInspection {
  const placeholders: string[] = [];
  const richTags: string[] = [];
  const tagPattern = /<([A-Za-z][A-Za-z0-9]*)\b/g;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagPattern.exec(value))) {
    richTags.push(tagMatch[1] ?? "");
  }

  let balanced = true;
  let index = 0;
  while (index < value.length) {
    if (value[index] === "'" && value[index + 1] === "'") {
      index += 2;
      continue;
    }
    if (value[index] === "'") {
      const end = value.indexOf("'", index + 1);
      index = end === -1 ? value.length : end + 1;
      continue;
    }
    if (value[index] !== "{") {
      index += 1;
      continue;
    }

    const argument = MESSAGE_ARGUMENT.exec(value.slice(index + 1));
    if (argument?.[0]) {
      placeholders.push(argument[0]);
    }

    let depth = 1;
    index += 1;
    while (index < value.length && depth > 0) {
      if (value[index] === "'" && value[index + 1] === "'") {
        index += 2;
        continue;
      }
      if (value[index] === "'") {
        const end = value.indexOf("'", index + 1);
        index = end === -1 ? value.length : end + 1;
        continue;
      }
      if (value[index] === "{") {
        depth += 1;
      } else if (value[index] === "}") {
        depth -= 1;
      }
      index += 1;
    }
    if (depth !== 0) {
      balanced = false;
    }
  }

  return { placeholders, richTags, balanced };
}

function sameTokenList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((token, tokenIndex) => token === sortedRight[tokenIndex]);
}

function describeStructureMismatch(english: string, target: string): string | null {
  const source = inspectMessageStructure(english);
  const translated = inspectMessageStructure(target);
  const problems: string[] = [];
  if (source.balanced && !translated.balanced) {
    problems.push("invalid message structure");
  }
  if (!sameTokenList(source.placeholders, translated.placeholders)) {
    const missing = source.placeholders.filter((token) => !translated.placeholders.includes(token));
    const extra = translated.placeholders.filter((token) => !source.placeholders.includes(token));
    if (missing.length > 0) {
      problems.push(`missing ${missing.map((token) => `{${token}}`).join(", ")}`);
    }
    if (extra.length > 0) {
      problems.push(`unexpected ${extra.map((token) => `{${token}}`).join(", ")}`);
    }
    if (missing.length === 0 && extra.length === 0) {
      problems.push("placeholder count differs");
    }
  }
  if (!sameTokenList(source.richTags, translated.richTags)) {
    const missing = source.richTags.filter((token) => !translated.richTags.includes(token));
    const extra = translated.richTags.filter((token) => !source.richTags.includes(token));
    if (missing.length > 0) {
      problems.push(`missing ${missing.map((token) => `<${token}>`).join(", ")}`);
    }
    if (extra.length > 0) {
      problems.push(`unexpected ${extra.map((token) => `<${token}>`).join(", ")}`);
    }
    if (missing.length === 0 && extra.length === 0) {
      problems.push("rich-text tag count differs");
    }
  }
  return problems.length > 0 ? problems.join("; ") : null;
}

function readPathValue(messages: MessagePack, dottedPath: string): unknown {
  let current: unknown = messages;
  for (const segment of dottedPath.split(".")) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function projectEnglishTree(paths: readonly string[]): WebUiMessageTree {
  const english = loadBundledEnglishWebUiMessagePack();
  const root: Record<string, unknown> = {};
  for (const pathKey of paths) {
    const value = readPathValue(english, pathKey);
    if (typeof value !== "string") {
      continue;
    }
    const segments = pathKey.split(".");
    let cursor = root;
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index] ?? "";
      const next = cursor[segment];
      if (next == null || typeof next !== "object" || Array.isArray(next)) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    const leaf = segments[segments.length - 1] ?? "";
    cursor[leaf] = value;
  }
  return root as WebUiMessageTree;
}

/** English catalog slice. "public" scope = ordinary Public ∪ Participant (15D.2). */
export function selectEnglishWebUiMessages(scope: WebUiMessagePackPreparationScope): {
  readonly messages: WebUiMessageTree;
  readonly publicRequiredKeyCount: number;
  readonly participantRequiredKeyCount: number;
  readonly fullCatalogKeyCount: number;
  readonly selectedPaths: readonly string[];
} {
  const english = loadBundledEnglishWebUiMessagePack();
  const allPaths = collectStringPaths(english);
  const publicPaths = allPaths.filter((pathKey) => isPublicReaderWebUiRequiredPath(pathKey));
  const participantPaths = allPaths.filter((pathKey) =>
    isParticipantWebUiRequiredPath(pathKey),
  );
  const ordinaryPaths = [
    ...new Set([
      ...publicPaths,
      ...participantPaths,
    ]),
  ].sort();
  const selectedPaths = scope === "full" ? allPaths : ordinaryPaths;
  return {
    messages: projectEnglishTree(selectedPaths),
    publicRequiredKeyCount: publicPaths.length,
    participantRequiredKeyCount: participantPaths.length,
    fullCatalogKeyCount: allPaths.length,
    selectedPaths,
  };
}

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

function englishFoundationValues(): ReadonlyMap<string, string> {
  if (englishValueMap) {
    return englishValueMap;
  }
  const values = new Map<string, string>();
  function walk(node: MessagePack, prefix: string): void {
    for (const [key, value] of Object.entries(node)) {
      const pathKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") {
        values.set(pathKey, value);
        continue;
      }
      if (value != null && typeof value === "object" && !Array.isArray(value)) {
        walk(value as MessagePack, pathKey);
      }
    }
  }
  walk(loadBundledEnglishWebUiMessagePack(), "");
  englishValueMap = values;
  return values;
}

/** Test-only — clear cached English path set after fixture mutation. */
export function resetEnglishWebUiPathCacheForTests(): void {
  englishPathSet = null;
  englishValueMap = null;
}

export function validateWebUiMessageTreeAgainstEnglish(
  messages: WebUiMessageTree,
): WebUiMessagePackValidationReport {
  if (messages == null || typeof messages !== "object" || Array.isArray(messages)) {
    return {
      acceptedKeyCount: 0,
      rejectedUnknownPaths: ["(messages root must be an object)"],
      rejectedNonStringPaths: [],
      emptyPaths: [],
      placeholderMismatchPaths: [],
    };
  }

  const allowed = englishFoundationPaths();
  const englishValues = englishFoundationValues();
  const rejectedUnknownPaths: string[] = [];
  const rejectedNonStringPaths: string[] = [];
  const emptyPaths: string[] = [];
  const placeholderMismatchPaths: string[] = [];
  let acceptedKeyCount = 0;

  function walk(node: unknown, prefix: string): void {
    if (typeof node === "string") {
      if (!allowed.has(prefix)) {
        rejectedUnknownPaths.push(prefix);
        return;
      }
      if (node.trim() === "") {
        emptyPaths.push(prefix);
      }
      const english = englishValues.get(prefix);
      if (english != null) {
        const mismatch = describeStructureMismatch(english, node);
        if (mismatch) {
          placeholderMismatchPaths.push(`${prefix} (${mismatch})`);
        }
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
    emptyPaths,
    placeholderMismatchPaths,
  };
}

export { collectStringPaths };

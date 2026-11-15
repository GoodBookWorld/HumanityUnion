/**
 * Additive WEB_UI merge: preserve every existing leaf; add only missing packaged leaves.
 * No provider calls. Does not delete or overwrite existing values.
 */

import type { WebUiMessageTree } from "@hu/types";

import { unflattenWebUiMessageMap } from "./web-ui-draft-builder.js";
import { collectStringPaths } from "./web-ui-message-pack.validate.js";

function flattenStringLeaves(
  messages: WebUiMessageTree | null | undefined,
): Map<string, string> {
  const flat = new Map<string, string>();
  if (!messages || typeof messages !== "object" || Array.isArray(messages)) {
    return flat;
  }
  for (const pathKey of collectStringPaths(messages as never)) {
    const value = readStringLeaf(messages, pathKey);
    if (typeof value === "string") {
      flat.set(pathKey, value);
    }
  }
  return flat;
}

function readStringLeaf(messages: WebUiMessageTree, dottedPath: string): string | undefined {
  const segments = dottedPath.split(".").filter(Boolean);
  let cursor: unknown = messages;
  for (const segment of segments) {
    if (cursor == null || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "string" ? cursor : undefined;
}

export type MergeMissingPackagedWebUiMessagesResult = {
  readonly messages: WebUiMessageTree;
  readonly existingKeyCount: number;
  readonly missingKeyCount: number;
  readonly expectedFinalCount: number;
  readonly addedPaths: readonly string[];
  /** True when at least one packaged leaf was added. */
  readonly changed: boolean;
};

/**
 * Build an additive merge of `existing` + missing leaves from `packaged`.
 * Existing string leaves always win. Packaged leaves whose paths already exist are skipped.
 */
export function mergeMissingPackagedWebUiMessages(input: {
  readonly existing: WebUiMessageTree | null | undefined;
  readonly packaged: WebUiMessageTree;
}): MergeMissingPackagedWebUiMessagesResult {
  const existingFlat = flattenStringLeaves(input.existing);
  const packagedFlat = flattenStringLeaves(input.packaged);
  const merged = new Map(existingFlat);
  const addedPaths: string[] = [];

  for (const [pathKey, value] of packagedFlat) {
    if (existingFlat.has(pathKey)) {
      continue;
    }
    merged.set(pathKey, value);
    addedPaths.push(pathKey);
  }

  addedPaths.sort();
  const existingKeyCount = existingFlat.size;
  const missingKeyCount = addedPaths.length;
  const expectedFinalCount = existingKeyCount + missingKeyCount;

  return {
    messages: unflattenWebUiMessageMap(Object.fromEntries(merged)),
    existingKeyCount,
    missingKeyCount,
    expectedFinalCount,
    addedPaths,
    changed: missingKeyCount > 0,
  };
}

export function countWebUiStringLeaves(messages: WebUiMessageTree | null | undefined): number {
  return flattenStringLeaves(messages).size;
}

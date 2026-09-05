/**
 * Reset 02 — presentation path helpers for build validation / provenance merge.
 */

import type { PublicPresentationNode } from "@hu/types";
import { isPublicProtectedValue } from "@hu/types";

function isPlainObject(value: unknown): value is Record<string, PublicPresentationNode> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type AutoPathNode = { readonly path: string; readonly value: string };

function collectInto(
  tree: PublicPresentationNode,
  keyPath: string,
  out: AutoPathNode[],
): void {
  if (tree === null || tree === undefined) {
    return;
  }
  if (typeof tree === "string") {
    if (keyPath && tree.trim()) {
      out.push({ path: keyPath, value: tree });
    }
    return;
  }
  if (isPublicProtectedValue(tree)) {
    return;
  }
  if (Array.isArray(tree)) {
    tree.forEach((entry, index) => {
      collectInto(entry, keyPath ? `${keyPath}[${index}]` : `[${index}]`, out);
    });
    return;
  }
  if (isPlainObject(tree)) {
    for (const [key, value] of Object.entries(tree)) {
      collectInto(value, keyPath ? `${keyPath}.${key}` : key, out);
    }
  }
}

export function collectAutoPaths(tree: PublicPresentationNode): AutoPathNode[] {
  const out: AutoPathNode[] = [];
  collectInto(tree, "", out);
  return out;
}

export function getPresentationValueAtPath(
  tree: PublicPresentationNode,
  path: string,
): PublicPresentationNode | undefined {
  if (!path) {
    return tree;
  }
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let current: unknown = tree;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number(part);
      current = current[index];
      continue;
    }
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
      continue;
    }
    return undefined;
  }
  return current as PublicPresentationNode;
}

export function setPresentationStringAtPath(
  tree: PublicPresentationNode,
  path: string,
  value: string,
): PublicPresentationNode {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  if (parts.length === 0) {
    return value;
  }

  function setAt(
    node: PublicPresentationNode,
    remaining: string[],
  ): PublicPresentationNode {
    const [head, ...rest] = remaining;
    if (!head) {
      return value;
    }
    if (rest.length === 0) {
      if (Array.isArray(node)) {
        const next = [...node];
        next[Number(head)] = value;
        return next;
      }
      if (isPlainObject(node)) {
        return { ...node, [head]: value };
      }
      return value;
    }
    if (Array.isArray(node)) {
      const next = [...node];
      const index = Number(head);
      next[index] = setAt(
        (next[index] ?? {}) as PublicPresentationNode,
        rest,
      ) as (typeof next)[number];
      return next;
    }
    if (isPlainObject(node)) {
      const child = (node[head] ?? {}) as PublicPresentationNode;
      return { ...node, [head]: setAt(child, rest) };
    }
    return { [head]: setAt({}, rest) } as PublicPresentationNode;
  }

  return setAt(tree, parts);
}

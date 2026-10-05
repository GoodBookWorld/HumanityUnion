/**
 * Effective WEB_UI message tree for a locale — same source for readiness, CV labels, and public API.
 * Order (Gate D): published remote/Admin Mongo pack → bundled filesystem pack → null.
 * Draft Mongo packs and activation checkpoints are never authority.
 * Side-effect free (no provider).
 */

import type { WebUiMessageTree } from "@hu/types";

import {
  getPublishedWebUiMessagePackByLocale,
} from "./web-ui-message-pack.repository.js";
import { loadBundledWebUiMessagePackFromFs } from "./web-ui-message-pack.validate.js";

export type EffectiveWebUiPackSource = "bundled" | "remote" | "none";

export type EffectiveWebUiMessagePack = {
  readonly locale: string;
  readonly messages: WebUiMessageTree;
  readonly source: Exclude<EffectiveWebUiPackSource, "none">;
  readonly revision: number | null;
};

export async function resolveEffectiveWebUiMessagePack(
  locale: string,
): Promise<EffectiveWebUiMessagePack | null> {
  const tag = locale.trim();
  if (!tag) {
    return null;
  }

  const remote = await getPublishedWebUiMessagePackByLocale(tag);
  if (remote) {
    return {
      locale: remote.locale,
      messages: remote.messages,
      source: "remote",
      revision: remote.revision,
    };
  }

  const bundled = loadBundledWebUiMessagePackFromFs(tag);
  if (bundled) {
    return {
      locale: tag,
      messages: bundled as WebUiMessageTree,
      source: "bundled",
      revision: null,
    };
  }

  return null;
}

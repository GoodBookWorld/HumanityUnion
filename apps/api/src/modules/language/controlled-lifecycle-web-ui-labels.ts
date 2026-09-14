/**
 * Localization Authority Closure 03 — load WEB_UI controlled lifecycle labels.
 *
 * Sync path for CT reassembly: bundled FS + in-memory published packs (tests).
 * Readiness/CV assessment uses `resolveEffectiveWebUiMessagePack` (async, Mongo).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { InitiativeLifecycleStageId } from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import { getWebUiMessagePackByLocaleMemory } from "../web-ui-message-packs/web-ui-message-pack.memory.store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = path.resolve(
  here,
  "../../../../web/src/features/i18n/messages",
);

type MessagePack = {
  readonly initiativeExperience?: {
    readonly stages?: Readonly<Record<string, string>>;
    readonly collaboration?: {
      readonly discussion?: {
        readonly chrome?: {
          readonly readyToCollaborate?: string;
          readonly helpful?: string;
          readonly notHelpful?: string;
        };
      };
    };
    readonly author?: {
      readonly analysis?: {
        readonly sourceSnapshot?: {
          readonly activeAllies?: string;
          readonly helpful?: string;
          readonly notHelpful?: string;
        };
      };
    };
  };
};

const packCache = new Map<string, MessagePack | null>();

function loadMessagePack(locale: string): MessagePack | null {
  if (packCache.has(locale)) {
    return packCache.get(locale) ?? null;
  }
  try {
    const raw = readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8");
    const pack = JSON.parse(raw) as MessagePack;
    packCache.set(locale, pack);
    return pack;
  } catch {
    const key = normalizeLanguageRegistryLocaleKey(locale);
    const remote = key ? getWebUiMessagePackByLocaleMemory(key) : null;
    if (remote?.status === "published") {
      const pack = remote.messages as MessagePack;
      packCache.set(locale, pack);
      return pack;
    }
    packCache.set(locale, null);
    return null;
  }
}

/** Test-only — clear locale pack cache after fixture mutation. */
export function resetWebUiControlledLabelCacheForTests(): void {
  packCache.clear();
}

export function loadWebUiControlledLifecycleStageLabel(input: {
  readonly stageId: InitiativeLifecycleStageId | string;
  readonly locale: string;
}): string | null {
  const pack = loadMessagePack(input.locale);
  const label = pack?.initiativeExperience?.stages?.[input.stageId];
  if (typeof label !== "string" || !label.trim()) {
    return null;
  }
  return label.trim();
}

export function loadWebUiReadyToCollaborateLabel(locale: string): string | null {
  const pack = loadMessagePack(locale);
  const label =
    pack?.initiativeExperience?.collaboration?.discussion?.chrome?.readyToCollaborate;
  if (typeof label !== "string" || !label.trim()) {
    return null;
  }
  return label.trim();
}

export function loadWebUiControlledDomainLabel(input: {
  readonly conceptId: string;
  readonly locale: string;
}): string | null {
  const pack = loadMessagePack(input.locale);
  const chrome = pack?.initiativeExperience?.collaboration?.discussion?.chrome;
  const snapshot = pack?.initiativeExperience?.author?.analysis?.sourceSnapshot;
  let label: string | undefined;
  switch (input.conceptId) {
    case "ready_to_collaborate":
      label = chrome?.readyToCollaborate;
      break;
    case "helpful":
      label = chrome?.helpful ?? snapshot?.helpful;
      break;
    case "not_helpful":
      label = chrome?.notHelpful ?? snapshot?.notHelpful;
      break;
    case "active_allies":
      label = snapshot?.activeAllies;
      break;
    default:
      label = undefined;
  }
  if (typeof label !== "string" || !label.trim()) {
    return null;
  }
  return label.trim();
}

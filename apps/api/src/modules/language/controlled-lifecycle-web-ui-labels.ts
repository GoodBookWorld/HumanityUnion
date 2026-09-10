/**
 * Localization Authority Closure 03 — load WEB_UI controlled lifecycle labels
 * from the existing next-intl message catalogs (source of truth).
 *
 * Used by Pack 03C.5 CT reassembly on the API so Terminology → WEB_UI → Registry
 * can run without a duplicate dictionary.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { InitiativeLifecycleStageId } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
// apps/api/src/modules/language → apps/web/src/features/i18n/messages
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

const packCache = new Map<string, MessagePack>();

function loadMessagePack(locale: string): MessagePack | null {
  const cached = packCache.get(locale);
  if (cached) {
    return cached;
  }
  try {
    const raw = readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8");
    const pack = JSON.parse(raw) as MessagePack;
    packCache.set(locale, pack);
    return pack;
  } catch {
    return null;
  }
}

/** WEB_UI `initiativeExperience.stages.<stageId>` for a locale, if present. */
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

/** WEB_UI ready-to-collaborate chrome label for a locale, if present. */
export function loadWebUiReadyToCollaborateLabel(locale: string): string | null {
  const pack = loadMessagePack(locale);
  const label =
    pack?.initiativeExperience?.collaboration?.discussion?.chrome?.readyToCollaborate;
  if (typeof label !== "string" || !label.trim()) {
    return null;
  }
  return label.trim();
}

/** WEB_UI discussion chrome / CA source-snapshot labels for domain controlled concepts. */
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

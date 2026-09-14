/**
 * Remote/Admin WEB_UI message pack source for next-intl.
 * Fetches published packs from the public API — side-effect free (no provider).
 */

import type { AbstractIntlMessages } from "next-intl";

import { API_BASE_URL } from "../../lib/api-base-url";
import type { UiMessagePack, UiMessagePackSource } from "./remote-pack-seam";

/**
 * Load a published remote WEB_UI pack for an arbitrary Registry locale.
 * Returns null when no published pack exists (404) or the API is unavailable.
 */
export async function loadRemoteUiMessagePack(locale: string): Promise<UiMessagePack | null> {
  const tag = locale.trim();
  if (!tag || tag === "en") {
    return null;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/web-ui-message-packs?locale=${encodeURIComponent(tag)}`,
      {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      },
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      return null;
    }
    const envelope = (await response.json()) as {
      success?: boolean;
      data?: {
        locale?: string;
        messages?: AbstractIntlMessages;
        source?: string;
      };
    };
    if (!envelope.success || !envelope.data?.messages || typeof envelope.data.messages !== "object") {
      return null;
    }
    return {
      locale: envelope.data.locale?.trim() || tag,
      messages: envelope.data.messages,
      source: "remote",
    };
  } catch {
    return null;
  }
}

export const remoteUiMessagePackSource: UiMessagePackSource = {
  load: loadRemoteUiMessagePack,
};

/**
 * RESET 05B — thin provider boundary for Initiative PLP materializer.
 * Default: fake_local deterministic transport (no Gemini import).
 * Optional: HU_INITIATIVE_PLP_PROVIDER=thin_gemini reuses Media thin HTTP boundary.
 */

import type { LanguageCode } from "@hu/types";

import { markInitiativePlpProviderCall } from "./counters.js";
import {
  INITIATIVE_PLP_FAKE_LOCAL_TRANSPORT_ID,
  INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY,
} from "./constants.js";

export type InitiativePlpProviderResult =
  | {
      readonly ok: true;
      readonly values: Readonly<Record<string, string>>;
      readonly PROVIDER_TRANSPORT: string;
      readonly PROVIDER_EXECUTION_BOUNDARY: typeof INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly message: string;
      readonly PROVIDER_TRANSPORT: string;
      readonly PROVIDER_EXECUTION_BOUNDARY: typeof INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY;
    };

export async function runInitiativePlpFakeLocalProvider(input: {
  readonly locale: LanguageCode;
  readonly autoValues: Readonly<Record<string, string>>;
  readonly sourceRecordId?: string;
  readonly sourceVersion?: string;
}): Promise<InitiativePlpProviderResult> {
  markInitiativePlpProviderCall();
  const values: Record<string, string> = {};
  for (const [path, value] of Object.entries(input.autoValues)) {
    values[path] =
      input.locale === "en" ? value : `[${input.locale}] ${value}`;
  }
  return {
    ok: true,
    values,
    PROVIDER_TRANSPORT: INITIATIVE_PLP_FAKE_LOCAL_TRANSPORT_ID,
    PROVIDER_EXECUTION_BOUNDARY: INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY,
  };
}

export async function runInitiativePlpThinProvider(input: {
  readonly locale: LanguageCode;
  readonly autoValues: Readonly<Record<string, string>>;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
}): Promise<InitiativePlpProviderResult> {
  const mode = (process.env.HU_INITIATIVE_PLP_PROVIDER ?? "fake_local")
    .trim()
    .toLowerCase();
  if (mode !== "thin_gemini" && mode !== "gemini") {
    return runInitiativePlpFakeLocalProvider(input);
  }

  try {
    const {
      importMediaPlpMaterializerProvider,
      callMediaPlpMaterializerProviderOnce,
    } = await import("../media-plp-materializer/provider-boundary.js");
    const imported = await importMediaPlpMaterializerProvider();
    // Media helper also increments its own counter; mirror into Initiative counter.
    markInitiativePlpProviderCall();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: imported.provider,
      locale: input.locale,
      autoValues: input.autoValues,
      sourceRecordId: input.sourceRecordId,
      sourceVersion: input.sourceVersion,
      PROVIDER_TRANSPORT: imported.PROVIDER_TRANSPORT,
    });
    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason,
        message: result.message,
        PROVIDER_TRANSPORT: result.PROVIDER_TRANSPORT,
        PROVIDER_EXECUTION_BOUNDARY: INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY,
      };
    }
    return {
      ok: true,
      values: result.values,
      PROVIDER_TRANSPORT: result.PROVIDER_TRANSPORT,
      PROVIDER_EXECUTION_BOUNDARY: INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "PROVIDER_FAILURE",
      message: error instanceof Error ? error.message : "provider import failed",
      PROVIDER_TRANSPORT: "thin_gemini_import_failed",
      PROVIDER_EXECUTION_BOUNDARY: INITIATIVE_PLP_PROVIDER_EXECUTION_BOUNDARY,
    };
  }
}

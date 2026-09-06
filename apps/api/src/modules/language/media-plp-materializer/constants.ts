/**
 * Reset 03B / 03B.2 — Media PLP materializer safety defaults.
 *
 * MEDIA_PLP_OPERATOR_MAX_RSS_MB default 400:
 * post-provider / overall hard guard for ~512MB Render class.
 *
 * MEDIA_PLP_OPERATOR_PRE_PROVIDER_MAX_RSS_MB default 220:
 * stricter ceiling before thin provider import/call on 512MB Starter.
 * Primary safety remains the thin import graph; this is a fail-closed backup.
 *
 * MEDIA_PLP_OPERATOR_MAX_PROVIDER_INPUT_BYTES default 8192:
 * trusted/principle AUTO bags are small (explanation or title+description).
 */

export const MEDIA_PLP_STAGING_DATABASE = "humanity_union_staging";

/** Overall / post-provider RSS hard guard (MB). Override via MEDIA_PLP_OPERATOR_MAX_RSS_MB. */
export const MEDIA_PLP_OPERATOR_DEFAULT_MAX_RSS_MB = 400;

/**
 * Stricter pre-provider RSS ceiling (MB) for 512MB Render Starter.
 * Override via MEDIA_PLP_OPERATOR_PRE_PROVIDER_MAX_RSS_MB.
 */
export const MEDIA_PLP_OPERATOR_DEFAULT_PRE_PROVIDER_MAX_RSS_MB = 220;

/** Conservative provider input byte cap. Override via MEDIA_PLP_OPERATOR_MAX_PROVIDER_INPUT_BYTES. */
export const MEDIA_PLP_OPERATOR_DEFAULT_MAX_PROVIDER_INPUT_BYTES = 8192;

export const CIVIC_MEDIA_CT_SOURCE_KIND = "civic_media";
export const CIVIC_MEDIA_CT_RECORD_ID = "civic-media-center";

export function resolveMediaPlpOperatorMaxRssMb(): number {
  const raw = process.env.MEDIA_PLP_OPERATOR_MAX_RSS_MB?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return MEDIA_PLP_OPERATOR_DEFAULT_MAX_RSS_MB;
}

export function resolveMediaPlpOperatorPreProviderMaxRssMb(): number {
  const raw = process.env.MEDIA_PLP_OPERATOR_PRE_PROVIDER_MAX_RSS_MB?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  const overall = resolveMediaPlpOperatorMaxRssMb();
  const stricter = MEDIA_PLP_OPERATOR_DEFAULT_PRE_PROVIDER_MAX_RSS_MB;
  return Math.min(stricter, overall);
}

export function resolveMediaPlpOperatorMaxProviderInputBytes(): number {
  const raw = process.env.MEDIA_PLP_OPERATOR_MAX_PROVIDER_INPUT_BYTES?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return MEDIA_PLP_OPERATOR_DEFAULT_MAX_PROVIDER_INPUT_BYTES;
}

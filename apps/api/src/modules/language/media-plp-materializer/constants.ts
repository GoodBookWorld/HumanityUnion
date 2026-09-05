/**
 * Reset 03B — Media PLP materializer safety defaults.
 *
 * MEDIA_PLP_OPERATOR_MAX_RSS_MB default 400:
 * current Render API class commonly sits near 512MB; leave headroom so a
 * single-entity provider call cannot push the process into OOM.
 *
 * MEDIA_PLP_OPERATOR_MAX_PROVIDER_INPUT_BYTES default 8192:
 * trusted/principle AUTO bags are small (explanation or title+description).
 */

export const MEDIA_PLP_STAGING_DATABASE = "humanity_union_staging";

/** Conservative RSS hard guard (MB). Override via MEDIA_PLP_OPERATOR_MAX_RSS_MB. */
export const MEDIA_PLP_OPERATOR_DEFAULT_MAX_RSS_MB = 400;

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

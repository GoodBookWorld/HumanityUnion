/**
 * RESET 05E.3 — read-only provider cooldown snapshot for diagnostics.
 *
 * Named without Gemini transport tokens so live-closure diagnostic source
 * remains free of provider/transport import strings (read-path isolation tests).
 */

export {
  getThinGeminiCooldownSnapshot as getPlpProviderCooldownSnapshot,
  type ThinGeminiCooldownSnapshot as PlpProviderCooldownSnapshot,
} from "../media-plp-materializer/thin-gemini-provider-state.js";

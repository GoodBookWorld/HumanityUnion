/**
 * Bounded Humanity Union terminology for translation prompts.
 * Keep short — never attach private data or full Initiative history.
 *
 * Pack 02F Task 05: English seed list remains the compatibility fallback when
 * locale-aware glossary context is unavailable. Call sites use
 * resolveProviderTerminologyContext(targetLocale) for live injection.
 */

import { buildEnglishProviderTerminologyContext } from "./terminology-glossary/terminology-glossary.seed.js";

export const HUMANITY_UNION_TRANSLATION_TERMINOLOGY = buildEnglishProviderTerminologyContext();

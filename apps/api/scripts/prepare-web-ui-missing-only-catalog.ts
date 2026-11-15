/**
 * Missing-only WEB_UI catalog preparation (ordinary + non-ordinary).
 *
 * Dry-run (default — no provider calls):
 *   node --import tsx apps/api/scripts/prepare-web-ui-missing-only-catalog.ts \
 *     --locale es \
 *     --existing-pack /path/to/es-published-pack.json \
 *     --english-name Spanish --native-name Español --text-direction ltr
 *
 * Bounded pilot (max 10 keys / 2 batches; does not publish):
 *   TRANSLATION_PROVIDER=gemini node --import tsx apps/api/scripts/prepare-web-ui-missing-only-catalog.ts \
 *     --locale es --existing-pack ... --english-name Spanish --native-name Español \
 *     --text-direction ltr --pilot-max-keys 10 --pilot-max-batches 2 --execute
 *
 * Full execute (Gemini only; does not publish):
 *   TRANSLATION_PROVIDER=gemini node --import tsx apps/api/scripts/prepare-web-ui-missing-only-catalog.ts \
 *     --locale he \
 *     --existing-pack /path/to/he-published-pack.json \
 *     --english-name Hebrew --native-name עברית --text-direction rtl \
 *     --use-live-terminology --execute
 *
 * Existing pack snapshot may be the public API envelope or a raw messages tree.
 * Output is a local catalog/pilot candidate only — never Admin Import / publish / CT / Registry.
 */
import { runWebUiMissingOnlyCatalogBuilder } from "../src/modules/web-ui-message-packs/web-ui-missing-only-catalog-builder.js";

try {
  await runWebUiMissingOnlyCatalogBuilder({ argv: process.argv.slice(2) });
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "WEB_UI missing-only catalog builder failed.",
  );
  process.exitCode = 1;
}

/**
 * Offline public WEB_UI draft builder.
 *
 * Dry-run:
 *   node --import tsx apps/api/scripts/prepare-web-ui-message-pack-draft.ts --locale <locale>
 *
 * Primary generation (live terminology recommended after owner prep):
 *   TRANSLATION_PROVIDER=gemini node --import tsx apps/api/scripts/prepare-web-ui-message-pack-draft.ts \
 *     --locale <locale> --use-live-terminology --execute
 *
 * Quality retry of suspicious English-identical leaves only:
 *   TRANSLATION_PROVIDER=gemini node --import tsx apps/api/scripts/prepare-web-ui-message-pack-draft.ts \
 *     --locale <locale> --retry-identical --use-live-terminology --execute
 *
 * Registry supplies englishName/nativeName/textDirection when available.
 * Otherwise pass --english-name --native-name --text-direction.
 * A real Gemini run requires TRANSLATION_PROVIDER=gemini and --execute.
 */
import { runWebUiDraftBuilder } from "../src/modules/web-ui-message-packs/web-ui-draft-builder.js";

try {
  await runWebUiDraftBuilder({ argv: process.argv.slice(2) });
} catch (error) {
  console.error(error instanceof Error ? error.message : "WEB_UI draft builder failed.");
  process.exitCode = 1;
}

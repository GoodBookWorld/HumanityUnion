/**
 * Offline public WEB_UI draft builder.
 *
 * Dry-run makes no provider call:
 *   node --import tsx apps/api/scripts/prepare-web-ui-message-pack-draft.ts --locale <locale> --english-name "Language" --native-name "Language" --text-direction ltr
 *
 * A real Gemini run also requires TRANSLATION_PROVIDER=gemini and --execute.
 * Do not add that flag unless the run is explicitly authorized.
 */
import { runWebUiDraftBuilder } from "../src/modules/web-ui-message-packs/web-ui-draft-builder.js";

try {
  await runWebUiDraftBuilder({ argv: process.argv.slice(2) });
} catch (error) {
  console.error(error instanceof Error ? error.message : "WEB_UI draft builder failed.");
  process.exitCode = 1;
}

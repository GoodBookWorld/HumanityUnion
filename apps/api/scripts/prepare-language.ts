/**
 * Generic language owner preparation (Brand + Terminology).
 *
 * Dry-run:
 *   node --import tsx apps/api/scripts/prepare-language.ts --locale <locale>
 *
 * Execute missing Brand/Terminology values (requires TRANSLATION_PROVIDER=gemini):
 *   TRANSLATION_PROVIDER=gemini node --import tsx apps/api/scripts/prepare-language.ts --locale <locale> --prepare-owners --execute
 *
 * Registry supplies englishName/nativeName/textDirection when available.
 * Otherwise pass --english-name --native-name --text-direction.
 */
import { runLanguageOwnerPreparation } from "../src/modules/language-preparation/language-owner-preparation.js";

const argv = process.argv.slice(2);
if (!argv.includes("--prepare-owners") && argv.includes("--execute")) {
  console.error("REFUSED: owner persistence requires --prepare-owners with --execute.");
  process.exitCode = 1;
} else {
  try {
    await runLanguageOwnerPreparation({
      argv,
      execute: argv.includes("--prepare-owners") && argv.includes("--execute"),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Language owner preparation failed.");
    process.exitCode = 1;
  }
}

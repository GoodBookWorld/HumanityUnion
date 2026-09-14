/**
 * Test-only preload: stub CSS for Media coverage SSR tests (CJS + ESM).
 * Usage: tsx --import ./src/features/language/media-plp/css-stub-register.mjs --test …
 */
import Module from "node:module";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// CJS / tsx require(".css") path
const extensions = Module._extensions;
extensions[".css"] = function stubCss(module) {
  module.exports = {};
};

const hooksUrl = new URL("./css-stub-hooks.mjs", import.meta.url);
register(hooksUrl.href, pathToFileURL("./"));

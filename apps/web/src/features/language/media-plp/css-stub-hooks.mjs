/**
 * Node custom loader hooks — stub .css imports for Media coverage SSR tests.
 */

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css") || specifier.includes(".css?")) {
    return {
      shortCircuit: true,
      url: new URL("./css-stub-module.mjs", import.meta.url).href,
    };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.includes("css-stub-module.mjs")) {
    return {
      format: "module",
      shortCircuit: true,
      source: "export default {};\n",
    };
  }
  return nextLoad(url, context);
}

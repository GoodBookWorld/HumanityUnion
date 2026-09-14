/**
 * CJS require hook that stubs .css imports for Node unit tests.
 */
const Module = require("node:module");

const extensions = Module._extensions;
if (!extensions[".css"]) {
  extensions[".css"] = function stubCss(module) {
    module.exports = {};
  };
}

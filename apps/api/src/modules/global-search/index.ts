export { default as globalSearchRouter } from "./global-search.routes.js";
export {
  parseCivicSearchQuery,
  sanitizeCivicSearchResponse,
  searchPublicCivicRecords,
} from "./global-search.service.js";
export {
  buildGlobalSearchIndex,
  getGlobalSearchIndex,
  resetGlobalSearchIndexForTests,
} from "./global-search.index.js";

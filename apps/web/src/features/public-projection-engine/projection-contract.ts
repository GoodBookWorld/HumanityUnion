/**
 * Capability 03 ↔ Capability 02 integration contract (compile-time verification).
 *
 * Experience pages must consume projections only through:
 * - loadGlobalExperienceProjections()
 * - loadCountryExperiencePageData(countrySlug)
 * - loadRegionExperiencePageData(regionSlug)
 * - loadCommunityExperiencePageData(slug)
 *
 * Projection payloads use @hu/types public models. Provider swap:
 * bootstrapPublicProjectionProvider → apiPublicProjectionProvider
 * via resolvePublicProjectionProvider() without UI changes.
 */
import type { PublicProjectionProvider } from "./provider";
import type { ApiPublicProjectionProvider } from "./providers/api-public-projection-provider";
import type { BootstrapPublicProjectionProvider } from "./providers/bootstrap-public-projection-provider";

type AssertPublicProjectionProvider<T extends PublicProjectionProvider> = T;

type _BootstrapProviderSatisfiesContract =
  AssertPublicProjectionProvider<BootstrapPublicProjectionProvider>;

type _ApiProviderSatisfiesContract = AssertPublicProjectionProvider<ApiPublicProjectionProvider>;

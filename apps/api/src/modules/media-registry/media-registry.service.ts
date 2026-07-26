import type { MediaRegistryFilter, MediaRegistryListing } from "@hu/types";
import {
  collectMediaRegistryFilterOptions,
  filterMediaRegistryProviders,
  MEDIA_REGISTRY_CATEGORIES,
  MEDIA_REGISTRY_REGION_TAGS,
  MEDIA_REGISTRY_UPDATED_AT,
  sortMediaRegistryProviders,
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
} from "@hu/media-registry";

export function listMediaRegistry(filter: MediaRegistryFilter = {}): MediaRegistryListing {
  const filtered = sortMediaRegistryProviders(
    filterMediaRegistryProviders(TRUSTED_GLOBAL_MEDIA_REGISTRY, filter),
  );

  return {
    providers: [...filtered],
    categories: [...MEDIA_REGISTRY_CATEGORIES],
    regionTags: [...MEDIA_REGISTRY_REGION_TAGS],
    updatedAt: MEDIA_REGISTRY_UPDATED_AT,
  };
}

export function getMediaRegistryFilterOptions() {
  return collectMediaRegistryFilterOptions(TRUSTED_GLOBAL_MEDIA_REGISTRY);
}

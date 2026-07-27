import type { MediaRegistryFilter, MediaRegistryProvider } from "@hu/types";

function normalizeFilterValue(value: string | undefined): string {
  return (value ?? "all").trim().toLowerCase();
}

export function filterMediaRegistryProviders(
  providers: readonly MediaRegistryProvider[],
  filter: MediaRegistryFilter,
): MediaRegistryProvider[] {
  const providerFilter = normalizeFilterValue(filter.provider);
  const countryFilter = normalizeFilterValue(filter.country);
  const languageFilter = normalizeFilterValue(filter.language);
  const categoryFilter = normalizeFilterValue(filter.category);
  const regionFilter = normalizeFilterValue(filter.region);

  return providers.filter((provider) => {
    if (providerFilter !== "all" && provider.id !== providerFilter && provider.name.toLowerCase() !== providerFilter) {
      return false;
    }

    if (countryFilter !== "all" && provider.country.toLowerCase() !== countryFilter) {
      return false;
    }

    if (languageFilter !== "all" && provider.language.toLowerCase() !== languageFilter) {
      return false;
    }

    if (
      categoryFilter !== "all" &&
      !provider.categories.some((category) => category.toLowerCase() === categoryFilter)
    ) {
      return false;
    }

    if (
      regionFilter !== "all" &&
      !provider.regionTags.some((region) => region.toLowerCase() === regionFilter)
    ) {
      return false;
    }

    return true;
  });
}

export function collectMediaRegistryFilterOptions(providers: readonly MediaRegistryProvider[]) {
  const providerOptions = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
  }));

  const countries = [...new Set(providers.map((provider) => provider.country))].sort((a, b) =>
    a.localeCompare(b),
  );

  const languages = [...new Set(providers.map((provider) => provider.language))].sort((a, b) =>
    a.localeCompare(b),
  );

  const categories = [
    ...new Set(providers.flatMap((provider) => provider.categories)),
  ].sort((a, b) => a.localeCompare(b));

  const regions = [...new Set(providers.flatMap((provider) => provider.regionTags))].sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    providers: providerOptions,
    countries,
    languages,
    categories,
    regions,
  };
}

export function sortMediaRegistryProviders(
  providers: readonly MediaRegistryProvider[],
): MediaRegistryProvider[] {
  return [...providers].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.name.localeCompare(right.name);
  });
}

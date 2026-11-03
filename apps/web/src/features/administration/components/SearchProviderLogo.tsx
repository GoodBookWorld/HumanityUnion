import type { SearchPerformanceProvider } from "../admin-seo-search-performance-model";

/** Locally stored provider marks; a provider without an approved asset shows no logo. */
export const SEARCH_PROVIDER_LOGOS: Readonly<Record<SearchPerformanceProvider, string | null>> = {
  google: "/icons/providers/google-search-console.svg",
  bing: "/icons/providers/bing-webmaster-tools.svg",
};

/** Decorative: the adjacent heading names the provider. */
export function SearchProviderLogo({ provider }: { provider: SearchPerformanceProvider }) {
  const src = SEARCH_PROVIDER_LOGOS[provider];
  if (!src) {
    return null;
  }
  return (
    <img
      className="admin-seo-search__logo"
      src={src}
      alt=""
      width={24}
      height={24}
      aria-hidden="true"
    />
  );
}

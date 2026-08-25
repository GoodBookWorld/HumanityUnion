export interface SitemapPathEntry {
  /** Canonical public path beginning with `/`. */
  path: string;
  lastModified?: Date | string;
}

export type SitemapProviderResult = readonly SitemapPathEntry[];

export type SitemapProvider = () => SitemapProviderResult | Promise<SitemapProviderResult>;

import type { MetadataRoute } from "next";

import { shouldDisallowSearchIndexing } from "../lib/platform-indexing";
import { resolvePublicSiteOrigin, toAbsolutePublicUrl } from "../lib/seo/public-site-url";

export default function robots(): MetadataRoute.Robots {
  if (shouldDisallowSearchIndexing()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const origin = resolvePublicSiteOrigin();
  const sitemapUrl = origin ? toAbsolutePublicUrl("/sitemap.xml", origin) : undefined;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/workspace/",
        "/notifications",
        "/preferences",
        "/login",
        "/account",
        "/password-reset",
        "/confirm-email",
        "/confirm-email-change",
      ],
    },
    ...(sitemapUrl ? { sitemap: sitemapUrl } : {}),
  };
}

import type { MetadataRoute } from "next";

import { shouldDisallowSearchIndexing } from "../lib/platform-indexing";

export default function robots(): MetadataRoute.Robots {
  if (shouldDisallowSearchIndexing()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

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
  };
}

"use client";

import { useEffect, useState } from "react";

import type { PlatformSocialAccountPublic } from "@hu/types";

import { fetchPublicPlatformSocialAccounts } from "../../platform-social-accounts/platform-social-accounts-public-api";
import { PLATFORM_SOCIAL_NETWORK_ICON_PATHS } from "../../platform-social-accounts/platform-social-network-icons";

/**
 * Pack 17C — public footer social icons resolve from canonical Admin settings.
 * Missing / disabled URLs are omitted (never render broken links).
 */
export function FooterSocialLinks() {
  const [accounts, setAccounts] = useState<readonly PlatformSocialAccountPublic[]>([]);

  useEffect(() => {
    let cancelled = false;

    void fetchPublicPlatformSocialAccounts()
      .then((response) => {
        if (!cancelled) {
          setAccounts(response.accounts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (accounts.length === 0) {
    return null;
  }

  return (
    <ul className="public-experience-footer__social-list">
      {accounts.map((social) => (
        <li key={social.networkId}>
          <a
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
          >
            <img
              src={PLATFORM_SOCIAL_NETWORK_ICON_PATHS[social.networkId]}
              alt=""
              className="public-experience-footer__social-icon"
              width={24}
              height={24}
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

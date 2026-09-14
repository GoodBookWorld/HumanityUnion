"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { CommunityCollaborationOpportunityProjection } from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { fetchWorldInitiativesProjection } from "../../initiatives/world-initiatives-api";
import {
  buildPwaFeedItemPresentation,
} from "../../language/adapters/pwa-feed-presentation";
import { getWorkspaceHome } from "../../workspace-home/workspace-home-api";

interface FeedItem {
  initiativeId: string;
  title: string;
  href: string;
  context?: string;
  explanation?: string;
  source: "preference" | "newest";
}

function preferenceMatches(
  items: readonly CommunityCollaborationOpportunityProjection[],
): FeedItem[] {
  return items
    .filter(
      (item): item is CommunityCollaborationOpportunityProjection & { initiativeId: string } =>
        item.kind === "priority_match" && Boolean(item.initiativeId),
    )
    .slice(0, 12)
    .map((item) => ({
      initiativeId: item.initiativeId,
      title: item.title,
      href: item.href || `/initiatives/public/${item.initiativeId}`,
      explanation: item.reasons[0]?.message,
      source: "preference" as const,
    }));
}

async function loadNewestPublicInitiatives(): Promise<FeedItem[]> {
  const world = await fetchWorldInitiativesProjection(12);
  return (world.initiatives ?? []).map((item) => ({
    initiativeId: item.initiativeId,
    title: item.title,
    href: item.publicInitiativeHref || `/initiatives/public/${item.initiativeId}`,
    context: [item.activityArea, item.geographyLabel].filter(Boolean).join(" · ") || undefined,
    explanation: item.currentStageLabel || undefined,
    source: "newest" as const,
  }));
}

/**
 * Mobile Initiative Feed projection — preference matches when Community Intelligence
 * supplies them; otherwise newest public Initiatives. No new domain type.
 * PWA UX Correction Pack 02 — horizontal mini-card carousel on mobile/app.
 *
 * Private `/workspace/home` is fetched only after canonical auth is authenticated.
 * Guests/pending never trigger that private projection (or Preferences-style refresh noise).
 *
 * Pack 08K — chrome via `pwa.feed.*`; semantic titles/explanations via
 * `buildPwaFeedItemPresentation` → PublicLocalizedPresentation boundary.
 */
export function PwaInitiativeFeed() {
  const t = useTranslations("pwa");
  const authStatus = useClientAuthStatus();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [mode, setMode] = useState<"preference" | "newest" | "loading" | "error">("loading");

  useEffect(() => {
    if (authStatus === "pending") {
      setMode("loading");
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        if (authStatus === "authenticated") {
          try {
            const home = await getWorkspaceHome();
            const matched = preferenceMatches(home.communityIntelligence?.items ?? []);

            if (matched.length > 0) {
              if (!cancelled) {
                setItems(matched);
                setMode("preference");
              }
              return;
            }
          } catch {
            // Fall through to public newest Initiatives — do not leave guests/auth failures stuck.
          }
        }

        const newest = await loadNewestPublicInitiatives();
        if (!cancelled) {
          setItems(newest);
          setMode("newest");
        }
      } catch {
        if (!cancelled) {
          setMode("error");
          setItems([]);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  return (
    <section className="hu-pwa-initiative-feed" aria-labelledby="hu-pwa-initiative-feed-title">
      <h2 id="hu-pwa-initiative-feed-title">{t("feed.title")}</h2>
      {mode === "loading" ? <p>{t("feed.loading")}</p> : null}
      {mode === "error" ? <p role="status">{t("feed.error")}</p> : null}
      {mode === "preference" ? (
        <p className="hu-pwa-initiative-feed__mode">{t("feed.matchedPriorities")}</p>
      ) : null}
      {mode === "newest" ? (
        <p className="hu-pwa-initiative-feed__mode">{t("feed.newestPublic")}</p>
      ) : null}

      {items.length > 0 ? (
        <ul className="hu-pwa-initiative-feed__list" aria-label={t("feed.carouselAria")}>
          {items.map((item) => {
            // Pack 08K — semantic titles via PublicPresentationNode adapter.
            const presentation = buildPwaFeedItemPresentation({
              initiativeId: item.initiativeId,
              title: item.title,
              context: item.context,
              explanation: item.explanation,
            });
            return (
            <li key={item.initiativeId} className="hu-pwa-initiative-feed__item">
              <Link className="hu-pwa-initiative-feed__card" href={item.href}>
                <h3 className="hu-pwa-initiative-feed__title">{presentation.title}</h3>
                {presentation.context ? (
                  <p className="hu-pwa-initiative-feed__context">{presentation.context}</p>
                ) : null}
                {presentation.explanation ? (
                  <p className="hu-pwa-initiative-feed__why">{presentation.explanation}</p>
                ) : null}
              </Link>
            </li>
            );
          })}
        </ul>
      ) : null}

      {mode === "newest" || mode === "preference" ? (
        <p>
          <Link href="/initiatives">{t("feed.viewAll")}</Link>
        </p>
      ) : null}
    </section>
  );
}

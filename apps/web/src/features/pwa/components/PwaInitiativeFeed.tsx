"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  DEFAULT_PLATFORM_LANGUAGE,
  type CommunityCollaborationOpportunityProjection,
} from "@hu/types";

import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { fetchWorldInitiativesProjection } from "../../initiatives/world-initiatives-api";
import { buildPwaFeedItemPresentation } from "../../language/adapters/pwa-feed-presentation";
import { useInitiativeCardTitlePresentation } from "../../public-initiative-experience/use-initiative-public-presentation";
import { resolveInitiativeCardStatusLabel } from "../../public-initiative-mini-card/resolve-initiative-card-semantic-labels";
import { getWorkspaceHome } from "../../workspace-home/workspace-home-api";

interface FeedItem {
  initiativeId: string;
  title: string;
  summary?: string;
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
      summary: item.summary,
      href: item.publicInitiativeHref || `/initiatives/public/${item.initiativeId}`,
      context: [item.activityArea, item.geographyLabel].filter(Boolean).join(" · ") || undefined,
      explanation: item.currentStageLabel || undefined,
      source: "newest" as const,
    }));
}

/**
 * Cache-only title. English and browser-native owners stay on the canonical
 * title, which remains a source-language island. A distinct CURRENT title
 * follows the document locale and is not marked browser-native English.
 */
function PwaInitiativeFeedCard({ item }: { item: FeedItem }) {
  const tExperience = useTranslations("initiativeExperience");
  const displayTitle = useInitiativeCardTitlePresentation({
    initiativeId: item.initiativeId,
    canonicalTitle: item.title,
    canonicalSummary: item.summary,
  });
  const presentation = buildPwaFeedItemPresentation({
    initiativeId: item.initiativeId,
    title: item.title,
    context: item.context,
    explanation: item.explanation,
  });
  const titleUsesCanonicalIsland = displayTitle === item.title;
  const statusLabel =
    item.source === "newest"
      ? resolveInitiativeCardStatusLabel(item.explanation, tExperience)
      : "";
  const canonicalExplanation = item.source === "preference" ? presentation.explanation : "";

  return (
    <li className="hu-pwa-initiative-feed__item">
      <Link className="hu-pwa-initiative-feed__card" href={item.href}>
        <h3
          className="hu-pwa-initiative-feed__title"
          {...(titleUsesCanonicalIsland
            ? {
                lang: DEFAULT_PLATFORM_LANGUAGE,
                "data-hu-content-lang": DEFAULT_PLATFORM_LANGUAGE,
                "data-hu-reading-owner": "browser-native" as const,
              }
            : {})}
        >
          {displayTitle}
        </h3>
        {statusLabel ? <p className="hu-pwa-initiative-feed__why">{statusLabel}</p> : null}
        {presentation.context || canonicalExplanation ? (
          <div
            className="hu-pwa-initiative-feed__canonical-reading"
            lang={DEFAULT_PLATFORM_LANGUAGE}
            data-hu-content-lang={DEFAULT_PLATFORM_LANGUAGE}
            data-hu-reading-owner="browser-native"
          >
            {presentation.context ? (
              <p className="hu-pwa-initiative-feed__context">{presentation.context}</p>
            ) : null}
            {canonicalExplanation ? (
              <p className="hu-pwa-initiative-feed__why">{canonicalExplanation}</p>
            ) : null}
          </div>
        ) : null}
      </Link>
    </li>
  );
}

/**
 * Mobile Initiative Feed projection — preference matches when Community Intelligence
 * supplies them; otherwise newest public Initiatives. No new domain type.
 * PWA UX Correction Pack 02 — horizontal mini-card carousel on mobile/app.
 *
 * Private `/workspace/home` is fetched only after canonical auth is authenticated.
 * Guests/pending never trigger that private projection (or Preferences-style refresh noise).
 *
 * Pack 08K — chrome via `pwa.feed.*`. Titles use the cache-only initiative
 * card presentation. Activity/geography context and preference explanations
 * stay canonical English; they are not Content Translation fields.
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
          {items.map((item) => (
            <PwaInitiativeFeedCard key={item.initiativeId} item={item} />
          ))}
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

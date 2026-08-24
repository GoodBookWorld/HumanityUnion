"use client";

import { useEffect, useId, useState } from "react";

import type {
  BlogHuPlatformDistributionChannel,
  BlogPublicationOptimization,
  BlogCoverMedia,
  PlatformSocialAccountPublic,
  PlatformSocialNetworkId,
} from "@hu/types";
import { PLATFORM_SOCIAL_NETWORKS } from "@hu/types";

import { HelperText } from "../../../design-system/components/HelperText";
import { fetchPublicPlatformSocialAccounts } from "../../platform-social-accounts/platform-social-accounts-public-api";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { BlogCoverField } from "./BlogCoverField";

const SEO_TITLE_GUIDE = 60;
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_GUIDE = 160;
const SEO_DESCRIPTION_MAX = 320;

export interface BlogPublicationOptimizationPanelProps {
  title: string;
  excerpt: string;
  slug: string;
  coverMedia: BlogCoverMedia | null;
  value: BlogPublicationOptimization;
  disabled?: boolean;
  onChange: (next: BlogPublicationOptimization) => void;
}

function charHint(length: number, guide: number, max: number): string {
  return `${length} / ${guide} recommended · max ${max}`;
}

function channelFor(
  channels: readonly BlogHuPlatformDistributionChannel[],
  networkId: PlatformSocialNetworkId,
): BlogHuPlatformDistributionChannel {
  return (
    channels.find((channel) => channel.networkId === networkId) ?? {
      networkId,
      permitted: false,
    }
  );
}

/**
 * Pack 16C / 17D — Publication Optimization (SEO, social preview, HU distribution intent).
 */
export function BlogPublicationOptimizationPanel({
  title,
  excerpt,
  slug,
  coverMedia,
  value,
  disabled,
  onChange,
}: BlogPublicationOptimizationPanelProps) {
  const seoTitleId = useId();
  const seoDescriptionId = useId();
  const socialTitleId = useId();
  const socialDescriptionId = useId();
  const distributionLegendId = useId();

  const [configuredAccounts, setConfiguredAccounts] = useState<
    readonly PlatformSocialAccountPublic[]
  >([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicPlatformSocialAccounts()
      .then((response) => {
        if (!cancelled) {
          setConfiguredAccounts(response.accounts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfiguredAccounts([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAccountsLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const seoTitle = value.seoTitle ?? "";
  const seoDescription = value.seoDescription ?? "";
  const socialTitle = value.socialTitle ?? "";
  const socialDescription = value.socialDescription ?? "";
  const socialImage = value.socialImage === undefined ? null : value.socialImage;
  const huPlatformChannels = value.distribution?.huPlatformChannels ?? [];

  const configuredIds = new Set(configuredAccounts.map((account) => account.networkId));

  const previewTitle = seoTitle.trim() || title.trim() || "Untitled publication";
  const previewDescription =
    seoDescription.trim() || excerpt.trim() || "Add a meta description for search results.";
  const previewSocialTitle = socialTitle.trim() || previewTitle;
  const previewSocialDescription = socialDescription.trim() || previewDescription;
  const previewSocialImage = socialImage?.mediaUrl || coverMedia?.mediaUrl || null;
  const canonicalPath = `/blog/${slug || "your-slug"}`;

  function patch(next: Partial<BlogPublicationOptimization>): void {
    onChange({
      ...value,
      ...next,
    });
  }

  function setChannelPermitted(networkId: PlatformSocialNetworkId, permitted: boolean): void {
    if (!configuredIds.has(networkId)) {
      return;
    }
    const nextChannels = PLATFORM_SOCIAL_NETWORKS.map(({ networkId: id }) => {
      const current = channelFor(huPlatformChannels, id);
      if (id !== networkId) {
        return {
          networkId: id,
          permitted: configuredIds.has(id) ? current.permitted : false,
        };
      }
      return { networkId: id, permitted };
    });
    const anyPermitted = nextChannels.some((channel) => channel.permitted);
    patch({
      distribution: {
        huSocialShare: anyPermitted ? "opt_in" : "unset",
        huPlatformChannels: nextChannels,
        authorExternalAccounts: [],
      },
    });
  }

  return (
    <section
      className="blog-publication-optimization"
      aria-labelledby="blog-publication-optimization-heading"
    >
      <h2 className="hu-heading-3" id="blog-publication-optimization-heading">
        Publication Optimization
      </h2>
      <p className="hu-caption blog-publication-optimization__lede">
        SEO and social metadata stay on this publication. Distribution permissions queue through the
        platform outbox for official Humanity Union channels — they never invent external credentials
        or claim a successful send.
      </p>

      <div className="blog-publication-optimization__grid">
        <section
          className="blog-publication-optimization__section blog-publication-optimization__section--seo"
          aria-labelledby="blog-seo-heading"
        >
          <h3 className="hu-heading-4" id="blog-seo-heading">
            Search Optimization
          </h3>
          <p className="hu-caption blog-publication-optimization__section-copy">
            Optional search title and description. Leave blank to fall back to the publication title
            and excerpt on the public page.
          </p>

          <label className="hu-label" htmlFor={seoTitleId}>
            SEO title
          </label>
          <input
            id={seoTitleId}
            className="hu-form-control"
            value={seoTitle}
            maxLength={SEO_TITLE_MAX}
            disabled={disabled}
            placeholder={title.trim() || "Defaults to publication title"}
            onChange={(event) => {
              patch({ seoTitle: event.target.value });
            }}
          />
          <HelperText>{charHint(seoTitle.length, SEO_TITLE_GUIDE, SEO_TITLE_MAX)}</HelperText>

          <label className="hu-label" htmlFor={seoDescriptionId}>
            Meta description
          </label>
          <textarea
            id={seoDescriptionId}
            className="hu-form-control"
            rows={3}
            maxLength={SEO_DESCRIPTION_MAX}
            value={seoDescription}
            disabled={disabled}
            placeholder={excerpt.trim() || "Defaults to excerpt"}
            onChange={(event) => {
              patch({ seoDescription: event.target.value });
            }}
          />
          <HelperText>
            {charHint(seoDescription.length, SEO_DESCRIPTION_GUIDE, SEO_DESCRIPTION_MAX)}
          </HelperText>

          <p className="hu-caption blog-publication-optimization__canonical">
            Slug / canonical URL preview: {canonicalPath}
          </p>

          <div
            className="blog-publication-optimization__serp"
            aria-label="Search result preview"
          >
            <p className="blog-publication-optimization__serp-url">
              humanityunion.org{canonicalPath}
            </p>
            <p className="blog-publication-optimization__serp-title">{previewTitle}</p>
            <p className="blog-publication-optimization__serp-desc">{previewDescription}</p>
          </div>
        </section>

        <section
          className="blog-publication-optimization__section blog-publication-optimization__section--social"
          aria-labelledby="blog-social-heading"
        >
          <h3 className="hu-heading-4" id="blog-social-heading">
            Social Preview
          </h3>
          <p className="hu-caption blog-publication-optimization__section-copy">
            How this publication may appear when shared. Image defaults to the cover when a social
            image is not set.
          </p>

          <label className="hu-label" htmlFor={socialTitleId}>
            Social title
          </label>
          <input
            id={socialTitleId}
            className="hu-form-control"
            value={socialTitle}
            maxLength={SEO_TITLE_MAX}
            disabled={disabled}
            placeholder={previewTitle}
            onChange={(event) => {
              patch({ socialTitle: event.target.value });
            }}
          />

          <label className="hu-label" htmlFor={socialDescriptionId}>
            Social description
          </label>
          <textarea
            id={socialDescriptionId}
            className="hu-form-control"
            rows={3}
            maxLength={SEO_DESCRIPTION_MAX}
            value={socialDescription}
            disabled={disabled}
            placeholder={previewDescription}
            onChange={(event) => {
              patch({ socialDescription: event.target.value });
            }}
          />

          <fieldset className="blog-publication-optimization__social-image" disabled={disabled}>
            <legend className="hu-label">Social image</legend>
            <HelperText>
              Optional. When empty, the cover image is used for social previews.
            </HelperText>
            <BlogCoverField
              coverMedia={socialImage}
              title={previewSocialTitle}
              disabled={disabled}
              onChange={(next) => {
                patch({ socialImage: next });
              }}
            />
          </fieldset>

          <div
            className="blog-publication-optimization__og-card"
            aria-label="Social share preview card"
          >
            {previewSocialImage ? (
              <img
                className="blog-publication-optimization__og-image"
                src={resolveMediaUrl(previewSocialImage) ?? previewSocialImage}
                alt=""
              />
            ) : (
              <div className="blog-publication-optimization__og-image-empty">
                <span className="hu-caption">No social image yet</span>
              </div>
            )}
            <div className="blog-publication-optimization__og-body">
              <p className="blog-publication-optimization__og-domain">humanityunion.org</p>
              <p className="blog-publication-optimization__og-title">{previewSocialTitle}</p>
              <p className="blog-publication-optimization__og-desc">{previewSocialDescription}</p>
            </div>
          </div>
        </section>

        <section
          className="blog-publication-optimization__section blog-publication-optimization__section--distribution"
          aria-labelledby="blog-distribution-heading"
        >
          <h3 className="hu-heading-4" id="blog-distribution-heading">
            Distribution
          </h3>
          <p className="hu-caption blog-publication-optimization__section-copy">
            Choose the Humanity Union social channels where this publication may be distributed.
            This is not access to your personal social accounts.
          </p>

          <fieldset
            className="blog-publication-optimization__hu-share"
            disabled={disabled}
            aria-describedby={`${distributionLegendId}-help`}
          >
            <legend className="hu-label" id={distributionLegendId}>
              Humanity Union social distribution
            </legend>
            <HelperText id={`${distributionLegendId}-help`}>
              Selecting a channel permits Humanity Union to distribute this publication through the
              official configured channel. A profile URL alone does not auto-post — delivery waits
              for a real provider integration. Preferences never bypass review, scheduling, or
              blocks.
            </HelperText>
            <ul className="blog-publication-optimization__account-list">
              {PLATFORM_SOCIAL_NETWORKS.map(({ networkId, label }) => {
                const configured = configuredIds.has(networkId);
                const channel = channelFor(huPlatformChannels, networkId);
                const unavailableReason = !accountsLoaded
                  ? "Loading…"
                  : configured
                    ? "External API not connected — permission only"
                    : "Official channel not configured";
                return (
                  <li key={networkId} className="blog-publication-optimization__account">
                    <label className="blog-publication-optimization__account-toggle">
                      <input
                        type="checkbox"
                        checked={configured && channel.permitted}
                        disabled={disabled || !configured}
                        onChange={(event) => {
                          setChannelPermitted(networkId, event.target.checked);
                        }}
                      />
                      <span>
                        {label}
                        <span className="hu-caption"> · {unavailableReason}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </section>
      </div>
    </section>
  );
}

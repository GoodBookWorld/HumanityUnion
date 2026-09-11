"use client";

import { useTranslations } from "next-intl";
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
import { PLATFORM_SOCIAL_NETWORK_ICON_PATHS } from "../../platform-social-accounts/platform-social-network-icons";
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
  const t = useTranslations("workspace.publishingPage");
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

  const previewTitle = seoTitle.trim() || title.trim() || t("editor.seo.untitled");
  const previewDescription =
    seoDescription.trim() || excerpt.trim() || t("editor.seo.addMetaDescription");
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
        {t("editor.seo.heading")}
      </h2>
      <p className="hu-caption blog-publication-optimization__lede">{t("editor.seo.lede")}</p>

      <div className="blog-publication-optimization__grid">
        <section
          className="blog-publication-optimization__section blog-publication-optimization__section--seo"
          aria-labelledby="blog-seo-heading"
        >
          <h3 className="hu-heading-4" id="blog-seo-heading">
            {t("editor.seo.searchHeading")}
          </h3>
          <p className="hu-caption blog-publication-optimization__section-copy">
            {t("editor.seo.searchCopy")}
          </p>

          <label className="hu-label" htmlFor={seoTitleId}>
            {t("editor.seo.seoTitle")}
          </label>
          <input
            id={seoTitleId}
            className="hu-form-control"
            value={seoTitle}
            maxLength={SEO_TITLE_MAX}
            disabled={disabled}
            placeholder={title.trim() || t("editor.seo.defaultsToTitle")}
            onChange={(event) => {
              patch({ seoTitle: event.target.value });
            }}
          />
          <HelperText>
            {t("editor.seo.charHint", {
              length: seoTitle.length,
              guide: SEO_TITLE_GUIDE,
              max: SEO_TITLE_MAX,
            })}
          </HelperText>

          <label className="hu-label" htmlFor={seoDescriptionId}>
            {t("editor.seo.metaDescription")}
          </label>
          <textarea
            id={seoDescriptionId}
            className="hu-form-control"
            rows={3}
            maxLength={SEO_DESCRIPTION_MAX}
            value={seoDescription}
            disabled={disabled}
            placeholder={excerpt.trim() || t("editor.seo.defaultsToExcerpt")}
            onChange={(event) => {
              patch({ seoDescription: event.target.value });
            }}
          />
          <HelperText>
            {t("editor.seo.charHint", {
              length: seoDescription.length,
              guide: SEO_DESCRIPTION_GUIDE,
              max: SEO_DESCRIPTION_MAX,
            })}
          </HelperText>

          <p className="hu-caption blog-publication-optimization__canonical">
            {t("editor.seo.canonicalPreview", { path: canonicalPath })}
          </p>

          <div
            className="blog-publication-optimization__serp"
            aria-label={t("editor.seo.serpAria")}
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
            {t("editor.seo.socialHeading")}
          </h3>
          <p className="hu-caption blog-publication-optimization__section-copy">
            {t("editor.seo.socialCopy")}
          </p>

          <label className="hu-label" htmlFor={socialTitleId}>
            {t("editor.seo.socialTitle")}
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
            {t("editor.seo.socialDescription")}
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
            <legend className="hu-label">{t("editor.seo.socialImage")}</legend>
            <HelperText>{t("editor.seo.socialImageHelper")}</HelperText>
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
            aria-label={t("editor.seo.socialPreviewAria")}
          >
            {previewSocialImage ? (
              <img
                className="blog-publication-optimization__og-image"
                src={resolveMediaUrl(previewSocialImage) ?? previewSocialImage}
                alt=""
              />
            ) : (
              <div className="blog-publication-optimization__og-image-empty">
                <span className="hu-caption">{t("editor.seo.noSocialImage")}</span>
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
            {t("editor.seo.distributionHeading")}
          </h3>
          <p className="hu-caption blog-publication-optimization__section-copy">
            {t("editor.seo.distributionCopy")}
          </p>

          <fieldset
            className="blog-publication-optimization__hu-share"
            disabled={disabled}
            aria-describedby={`${distributionLegendId}-help`}
          >
            <legend className="hu-label" id={distributionLegendId}>
              {t("editor.seo.huShareLegend")}
            </legend>
            <HelperText id={`${distributionLegendId}-help`}>
              {t("editor.seo.huShareHelper")}
            </HelperText>
            <ul className="blog-publication-optimization__account-list">
              {PLATFORM_SOCIAL_NETWORKS.map(({ networkId, label }) => {
                const configured = configuredIds.has(networkId);
                const channel = channelFor(huPlatformChannels, networkId);
                const unavailableReason = !accountsLoaded
                  ? t("editor.seo.channelLoading")
                  : configured
                    ? t("editor.seo.channelApiOnly")
                    : t("editor.seo.channelNotConfigured");
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
                      <img
                        src={PLATFORM_SOCIAL_NETWORK_ICON_PATHS[networkId]}
                        alt=""
                        className="blog-publication-optimization__network-icon"
                        width={18}
                        height={18}
                        aria-hidden="true"
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

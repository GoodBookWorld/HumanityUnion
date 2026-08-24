"use client";

import { useId } from "react";

import type {
  BlogAuthorExternalSocialAccountPreference,
  BlogCoverMedia,
  BlogExternalSocialProviderId,
  BlogHuSocialDistributionPreference,
  BlogPublicationOptimization,
} from "@hu/types";

import { HelperText } from "../../../design-system/components/HelperText";
import { resolveMediaUrl } from "../../media-upload/media-url";
import { BlogCoverField } from "./BlogCoverField";

const SEO_TITLE_GUIDE = 60;
const SEO_TITLE_MAX = 70;
const SEO_DESCRIPTION_GUIDE = 160;
const SEO_DESCRIPTION_MAX = 320;

const EXTERNAL_PROVIDER_OPTIONS: readonly {
  provider: BlogExternalSocialProviderId;
  label: string;
}[] = [
  { provider: "facebook", label: "Facebook" },
  { provider: "x", label: "X" },
  { provider: "linkedin", label: "LinkedIn" },
];

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

function accountFor(
  accounts: readonly BlogAuthorExternalSocialAccountPreference[],
  provider: BlogExternalSocialProviderId,
): BlogAuthorExternalSocialAccountPreference {
  const existing = accounts.find((account) => account.provider === provider);
  return (
    existing ?? {
      provider,
      enabled: false,
      connectionStatus: "not_connected",
    }
  );
}

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
  const huShareId = useId();

  const seoTitle = value.seoTitle ?? "";
  const seoDescription = value.seoDescription ?? "";
  const socialTitle = value.socialTitle ?? "";
  const socialDescription = value.socialDescription ?? "";
  const socialImage =
    value.socialImage === undefined ? null : value.socialImage;
  const huSocialShare: BlogHuSocialDistributionPreference =
    value.distribution?.huSocialShare ?? "unset";
  const authorAccounts = value.distribution?.authorExternalAccounts ?? [];

  const previewTitle = seoTitle.trim() || title.trim() || "Untitled publication";
  const previewDescription =
    seoDescription.trim() || excerpt.trim() || "Add a meta description for search results.";
  const previewSocialTitle = socialTitle.trim() || previewTitle;
  const previewSocialDescription =
    socialDescription.trim() || previewDescription;
  const previewSocialImage = socialImage?.mediaUrl || coverMedia?.mediaUrl || null;
  const canonicalPath = `/blog/${slug || "your-slug"}`;

  function patch(next: Partial<BlogPublicationOptimization>): void {
    onChange({
      ...value,
      ...next,
    });
  }

  function setHuShare(next: BlogHuSocialDistributionPreference): void {
    patch({
      distribution: {
        huSocialShare: next,
        authorExternalAccounts: authorAccounts.map((account) => ({ ...account })),
      },
    });
  }

  function setExternalEnabled(provider: BlogExternalSocialProviderId, enabled: boolean): void {
    const nextAccounts = EXTERNAL_PROVIDER_OPTIONS.map(({ provider: id, label }) => {
      const current = accountFor(authorAccounts, id);
      if (id !== provider) {
        return { ...current, label: current.label ?? label };
      }
      return {
        ...current,
        label: current.label ?? label,
        enabled,
        connectionStatus: "not_connected" as const,
      };
    });
    patch({
      distribution: {
        huSocialShare,
        authorExternalAccounts: nextAccounts,
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
      <p className="hu-caption">
        SEO and social metadata stay on this publication. Distribution preferences enqueue through
        the platform outbox — they never invent external credentials or claim a successful send.
      </p>

      <div className="blog-publication-optimization__grid">
        <section
          className="blog-publication-optimization__section"
          aria-labelledby="blog-seo-heading"
        >
          <h3 className="hu-heading-4" id="blog-seo-heading">
            Search Optimization
          </h3>

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
          className="blog-publication-optimization__section"
          aria-labelledby="blog-social-heading"
        >
          <h3 className="hu-heading-4" id="blog-social-heading">
            Social Preview
          </h3>

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
          className="blog-publication-optimization__section"
          aria-labelledby="blog-distribution-heading"
        >
          <h3 className="hu-heading-4" id="blog-distribution-heading">
            Distribution
          </h3>

          <fieldset className="blog-publication-optimization__hu-share" disabled={disabled}>
            <legend className="hu-label" id={huShareId}>
              Humanity Union social distribution
            </legend>
            <HelperText>
              Opting in queues a platform outbox request for HU-owned channels. It does not post
              immediately and does not confirm delivery by itself.
            </HelperText>
            {(
              [
                ["unset", "No preference"],
                ["opt_in", "Opt in (queue for HU channels)"],
                ["opt_out", "Opt out"],
              ] as const
            ).map(([valueOption, label]) => (
              <label key={valueOption} className="blog-publication-optimization__radio">
                <input
                  type="radio"
                  name={huShareId}
                  value={valueOption}
                  checked={huSocialShare === valueOption}
                  disabled={disabled}
                  onChange={() => {
                    setHuShare(valueOption);
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>

          <div className="blog-publication-optimization__external">
            <p className="hu-label">Author connected social accounts</p>
            <HelperText>
              Personal external distribution is Author-controlled. Connections are not available yet —
              preferences are saved as not connected until a real provider integration exists.
            </HelperText>
            <ul className="blog-publication-optimization__account-list">
              {EXTERNAL_PROVIDER_OPTIONS.map(({ provider, label }) => {
                const account = accountFor(authorAccounts, provider);
                return (
                  <li key={provider} className="blog-publication-optimization__account">
                    <label className="blog-publication-optimization__account-toggle">
                      <input
                        type="checkbox"
                        checked={account.enabled}
                        disabled={disabled}
                        onChange={(event) => {
                          setExternalEnabled(provider, event.target.checked);
                        }}
                      />
                      <span>
                        {label}
                        <span className="hu-caption"> · not connected</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </section>
  );
}

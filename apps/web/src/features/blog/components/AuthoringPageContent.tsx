"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import type { BlogAuthoringAccessState, BlogCategoryId } from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
} from "../../../lib/api-client";
import {
  fetchBlogAuthoringAccessState,
  resubmitBlogAuthorApplication,
  submitBlogAuthorApplication,
} from "../authoring-api";
import { MyPublicationsTable } from "./MyPublicationsTable";

import "../authoring.css";

const CATEGORY_GUIDANCE_KEYS: Record<
  string,
  "categories.consciousExistence" | "categories.humanSecurity" | "categories.ourLife"
> = {
  conscious_existence: "categories.consciousExistence",
  human_security: "categories.humanSecurity",
  our_life: "categories.ourLife",
};

function categoryGuidanceKey(
  categoryId: BlogCategoryId,
): "categories.consciousExistence" | "categories.humanSecurity" | "categories.ourLife" {
  return CATEGORY_GUIDANCE_KEYS[categoryId] ?? "categories.consciousExistence";
}

function StatusMessage({ state }: { state: BlogAuthoringAccessState }) {
  const t = useTranslations("authoringPage");

  switch (state.presentation) {
    case "application_submitted":
      return (
        <StatusBanner
          title={t("status.applicationReceivedTitle")}
          message={t("status.applicationReceivedBody")}
        />
      );
    case "application_under_review":
      return (
        <StatusBanner
          title={t("status.applicationPendingTitle")}
          message={t("status.applicationPendingBody")}
        />
      );
    case "application_changes_requested":
      return (
        <StatusBanner
          title={t("status.changesRequestedTitle")}
          message={
            state.application?.reviewNote
              ? state.application.reviewNote
              : t("status.changesRequestedFallback")
          }
        />
      );
    case "application_declined":
      return (
        <StatusBanner
          title={t("status.declinedTitle")}
          message={
            state.application?.reviewNote
              ? state.application.reviewNote
              : t("status.declinedFallback")
          }
        />
      );
    case "author_blocked":
      return (
        <StatusBanner
          title={t("status.blockedTitle")}
          message={t("status.blockedBody")}
        />
      );
    case "author":
      return (
        <StatusBanner
          title={t("status.authorTitle")}
          message={t("status.authorBody")}
        />
      );
    case "trusted_author":
      return (
        <StatusBanner
          title={t("status.trustedAuthorTitle")}
          message={t("status.trustedAuthorBody")}
        />
      );
    case "editor":
    case "administrator":
      // Privileged editorial chrome — outside ordinary Participant WEB_UI readiness.
      return (
        <StatusBanner
          title="Editorial access"
          message="You can open Editorial Review from Workspace to review Blog publications awaiting decision."
        />
      );
    default:
      return null;
  }
}

export function AuthoringPageContent() {
  const t = useTranslations("authoringPage");
  const [state, setState] = useState<BlogAuthoringAccessState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "submitting" | "success">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [motivation, setMotivation] = useState("");
  const [topics, setTopics] = useState("");
  const [previousWritingUrl, setPreviousWritingUrl] = useState("");
  const [preferredCategoryIds, setPreferredCategoryIds] = useState<BlogCategoryId[]>([]);
  const [agreedToStandards, setAgreedToStandards] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchBlogAuthoringAccessState()
      .then((access) => {
        if (!cancelled) {
          setState(access);
          setLoading(false);
          if (access.application) {
            setMotivation(access.application.motivation);
            setTopics(access.application.topics);
            setPreviousWritingUrl(access.application.previousWritingUrl ?? "");
            setPreferredCategoryIds([...access.application.preferredCategoryIds]);
            setAgreedToStandards(access.application.agreedToStandards);
          }
        }
      })
      .catch((fetchError: unknown) => {
        if (cancelled) {
          return;
        }
        setLoading(false);
        if (isAuthenticationRequiredError(fetchError)) {
          setError(t("signInRequired"));
          return;
        }
        setError(formatAuthFormError(fetchError));
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  function toggleCategory(categoryId: BlogCategoryId) {
    setPreferredCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) {
      return;
    }

    const nextErrors: Record<string, string> = {};
    if (motivation.trim().length < 10) {
      nextErrors.motivation = t("application.motivationError");
    }
    if (topics.trim().length < 10) {
      nextErrors.topics = t("application.topicsError");
    }
    if (preferredCategoryIds.length === 0) {
      nextErrors.preferredCategoryIds = t("application.preferredCategoriesError");
    }
    if (!agreedToStandards) {
      nextErrors.agreedToStandards = t("application.agreeStandardsError");
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setSubmitPhase("submitting");
    setFormError(null);

    const payload = {
      motivation: motivation.trim(),
      topics: topics.trim(),
      previousWritingUrl: previousWritingUrl.trim() || undefined,
      preferredCategoryIds,
      agreedToStandards: true as const,
    };

    try {
      if (state.canResubmit && state.application) {
        await resubmitBlogAuthorApplication(state.application.applicationId, payload);
      } else {
        await submitBlogAuthorApplication(payload);
      }
      const refreshed = await fetchBlogAuthoringAccessState();
      setState(refreshed);
      setSubmitPhase("success");
    } catch (submitError: unknown) {
      setSubmitPhase("idle");
      setFormError(formatAuthFormError(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="authoring-page">
        <p className="hu-body">{t("loading")}</p>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="authoring-page">
        <p className="hu-body" role="alert">
          {error ?? t("unavailable")}
        </p>
        <Link href="/login" className="hu-button hu-button--secondary hu-button--sm">
          {t("signIn")}
        </Link>
      </div>
    );
  }

  const showForm = state.canApply || state.canResubmit;
  const isBlockedAuthor = state.presentation === "author_blocked";
  const isPublishingReady =
    !isBlockedAuthor &&
    (state.presentation === "author" ||
      state.presentation === "trusted_author" ||
      state.presentation === "editor" ||
      state.presentation === "administrator");
  const showMyPublications =
    state.presentation === "author" ||
    state.presentation === "trusted_author" ||
    state.presentation === "editor" ||
    state.presentation === "administrator" ||
    state.presentation === "author_blocked";
  const canDirectPublish =
    state.capabilities.includes("trusted_author") ||
    state.capabilities.includes("editor") ||
    state.capabilities.includes("administrator");

  return (
    <div className="authoring-page">
      <StatusMessage state={state} />

      {isBlockedAuthor ? (
        <p className="hu-body">{t("blockedWorkspaceNote")}</p>
      ) : null}

      {isPublishingReady ? (
        <Card className="authoring-page__card">
          <h2 className="hu-heading-3">{t("publishing.title")}</h2>
          <p className="hu-body">{t("publishing.body")}</p>
          {state.publishingWorkspaceHref ? (
            <p className="hu-form-actions">
              <Link
                href={state.publishingWorkspaceHref}
                className="hu-button hu-button--primary hu-button--sm"
              >
                {t("publishing.openPublishing")}
              </Link>
              <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
                {t("publishing.visitPublicBlog")}
              </Link>
            </p>
          ) : (
            <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
              {t("publishing.visitPublicBlog")}
            </Link>
          )}
        </Card>
      ) : null}

      {!isPublishingReady && !isBlockedAuthor ? (
        <Card className="authoring-page__card">
          <h2 className="hu-heading-2">{t("becomeAuthor.title")}</h2>
          <p className="hu-body">{t("becomeAuthor.thanks")}</p>
          <p className="hu-body">{t("becomeAuthor.purpose")}</p>
          <p className="hu-body">{t("becomeAuthor.encouragement")}</p>
          <p className="hu-body">{t("becomeAuthor.standards")}</p>
        </Card>
      ) : null}

      {!isPublishingReady && !isBlockedAuthor ? (
        <section className="authoring-page__categories" aria-labelledby="authoring-categories-title">
          <h2 id="authoring-categories-title" className="hu-heading-3">
            {t("categories.title")}
          </h2>
          <p className="hu-body authoring-page__muted">{t("categories.guidanceOnly")}</p>
          <div className="authoring-page__category-grid">
            {BLOG_CATEGORIES.map((category) => (
              <Card key={category.categoryId} className="authoring-page__category-card">
                <h3 className="hu-heading-4">{category.name}</h3>
                <p className="hu-body">{t(categoryGuidanceKey(category.categoryId))}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {showForm ? (
        <Card className="authoring-page__card">
          <h2 className="hu-heading-3">
            {state.canResubmit ? t("application.updateTitle") : t("application.title")}
          </h2>
          <form className="authoring-page__form" onSubmit={handleSubmit} noValidate>
            <div className="authoring-page__field">
              <label htmlFor="authoring-motivation">{t("application.motivationLabel")}</label>
              <textarea
                id="authoring-motivation"
                className="hu-form-control"
                rows={4}
                value={motivation}
                onChange={(event) => setMotivation(event.target.value)}
                aria-invalid={Boolean(fieldErrors.motivation)}
                aria-describedby={fieldErrors.motivation ? "authoring-motivation-error" : undefined}
              />
              {fieldErrors.motivation ? (
                <p id="authoring-motivation-error" className="authoring-page__error" role="alert">
                  {fieldErrors.motivation}
                </p>
              ) : null}
            </div>

            <div className="authoring-page__field">
              <label htmlFor="authoring-topics">{t("application.topicsLabel")}</label>
              <textarea
                id="authoring-topics"
                className="hu-form-control"
                rows={3}
                value={topics}
                onChange={(event) => setTopics(event.target.value)}
                aria-invalid={Boolean(fieldErrors.topics)}
                aria-describedby={fieldErrors.topics ? "authoring-topics-error" : undefined}
              />
              {fieldErrors.topics ? (
                <p id="authoring-topics-error" className="authoring-page__error" role="alert">
                  {fieldErrors.topics}
                </p>
              ) : null}
            </div>

            <div className="authoring-page__field">
              <label htmlFor="authoring-previous">{t("application.previousWritingLabel")}</label>
              <input
                id="authoring-previous"
                className="hu-form-control"
                type="url"
                inputMode="url"
                placeholder={t("application.previousWritingPlaceholder")}
                value={previousWritingUrl}
                onChange={(event) => setPreviousWritingUrl(event.target.value)}
              />
            </div>

            <fieldset className="authoring-page__fieldset">
              <legend>{t("application.preferredCategoriesLegend")}</legend>
              <p className="hu-body authoring-page__muted" id="authoring-categories-help">
                {t("application.preferredCategoriesHelp")}
              </p>
              <div
                className="authoring-page__checkbox-grid"
                role="group"
                aria-describedby="authoring-categories-help"
              >
                {BLOG_CATEGORIES.map((category) => (
                  <label key={category.categoryId} className="authoring-page__checkbox">
                    <input
                      type="checkbox"
                      checked={preferredCategoryIds.includes(category.categoryId)}
                      onChange={() => toggleCategory(category.categoryId)}
                    />
                    <span>{category.name}</span>
                  </label>
                ))}
              </div>
              {fieldErrors.preferredCategoryIds ? (
                <p className="authoring-page__error" role="alert">
                  {fieldErrors.preferredCategoryIds}
                </p>
              ) : null}
            </fieldset>

            <label className="authoring-page__checkbox authoring-page__checkbox--agreement">
              <input
                type="checkbox"
                checked={agreedToStandards}
                onChange={(event) => setAgreedToStandards(event.target.checked)}
                aria-invalid={Boolean(fieldErrors.agreedToStandards)}
              />
              <span>{t("application.agreeStandards")}</span>
            </label>
            {fieldErrors.agreedToStandards ? (
              <p className="authoring-page__error" role="alert">
                {fieldErrors.agreedToStandards}
              </p>
            ) : null}

            {formError ? (
              <p className="authoring-page__error" role="alert">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="primary"
              disabled={submitting || submitPhase === "success"}
              aria-busy={submitting || submitPhase === "success"}
              ariaLive="polite"
            >
              {submitPhase === "submitting"
                ? t("application.submitting")
                : submitPhase === "success"
                  ? t("application.submitted")
                  : state.canResubmit
                    ? t("application.resubmit")
                    : t("application.submit")}
            </Button>
          </form>
        </Card>
      ) : null}

      {showMyPublications ? (
        <MyPublicationsTable
          mutationsDisabled={isBlockedAuthor}
          canDirectPublish={canDirectPublish}
        />
      ) : null}
    </div>
  );
}

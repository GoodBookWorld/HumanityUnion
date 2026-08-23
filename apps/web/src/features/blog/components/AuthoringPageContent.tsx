"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

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

const CATEGORY_GUIDANCE: Record<BlogCategoryId, string> = {
  conscious_existence:
    "Reflection, knowledge, awareness, social understanding, education, and human development.",
  human_security:
    "Safety, rights, peace, institutions, public risks, protection, and social stability.",
  our_life:
    "Everyday life, communities, relationships, culture, environment, and personal and collective experience.",
};

function StatusMessage({ state }: { state: BlogAuthoringAccessState }) {
  switch (state.presentation) {
    case "application_submitted":
      return (
        <StatusBanner
          title="Application received"
          message="Your Author application has been received. We will review it and respond as soon as possible."
        />
      );
    case "application_under_review":
      return (
        <StatusBanner
          title="Application pending"
          message="Your Author application is pending review. We will respond as soon as possible."
        />
      );
    case "application_changes_requested":
      return (
        <StatusBanner
          title="Changes requested"
          message={
            state.application?.reviewNote
              ? state.application.reviewNote
              : "Changes were requested before your application can continue."
          }
        />
      );
    case "application_declined":
      return (
        <StatusBanner
          title="Author application update"
          message={
            state.application?.reviewNote
              ? state.application.reviewNote
              : "Your Author application was not accepted at this time. You may submit a new application."
          }
        />
      );
    case "author_blocked":
      return (
        <StatusBanner
          title="Author access blocked"
          message="Your Author access has been blocked. Please contact the administrator."
        />
      );
    case "author":
      return (
        <StatusBanner
          title="Author access granted"
          message="You can now create and submit Blog publications in the Publishing Workspace."
        />
      );
    case "trusted_author":
      return (
        <StatusBanner
          title="Trusted Author"
          message="Trusted Authors may publish their own accepted content directly, unless Safety requires review. Safety cannot be bypassed."
        />
      );
    case "editor":
    case "administrator":
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
          setError("Sign in to access Authoring.");
          return;
        }
        setError(formatAuthFormError(fetchError));
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      nextErrors.motivation = "Please share a bit more about why you would like to contribute.";
    }
    if (topics.trim().length < 10) {
      nextErrors.topics = "Please describe the topics you would like to write about.";
    }
    if (preferredCategoryIds.length === 0) {
      nextErrors.preferredCategoryIds = "Select at least one preferred category.";
    }
    if (!agreedToStandards) {
      nextErrors.agreedToStandards =
        "You must agree to follow platform Safety and publishing standards.";
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
        <p className="hu-body">Loading Authoring…</p>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="authoring-page">
        <p className="hu-body" role="alert">
          {error ?? "Authoring is unavailable."}
        </p>
        <Link href="/login" className="hu-button hu-button--secondary hu-button--sm">
          Sign in
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
        <p className="hu-body">
          Your Participant Workspace remains available. Author publishing tools are suspended until
          an Administrator restores access.
        </p>
      ) : null}

      {isPublishingReady ? (
        <Card className="authoring-page__card">
          <h2 className="hu-heading-3">Publishing Workspace</h2>
          <p className="hu-body">
            You can now create and submit Blog publications. Open Publishing to manage drafts,
            preview privately, and submit for review.
          </p>
          {state.publishingWorkspaceHref ? (
            <p className="hu-form-actions">
              <Link
                href={state.publishingWorkspaceHref}
                className="hu-button hu-button--primary hu-button--sm"
              >
                Open Publishing
              </Link>
              <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
                Visit public Blog
              </Link>
            </p>
          ) : (
            <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
              Visit public Blog
            </Link>
          )}
        </Card>
      ) : null}

      {!isPublishingReady && !isBlockedAuthor ? (
        <Card className="authoring-page__card">
          <h2 className="hu-heading-2">Become a Blog Author</h2>
          <p className="hu-body">
            Thank you for your interest in contributing to the Humanity Union Blog.
          </p>
          <p className="hu-body">
            The Blog is a place for thoughtful publications that can help people understand ideas,
            challenges, experience and possible solutions from a perspective of humanity,
            responsibility and constructive dialogue.
          </p>
          <p className="hu-body">
            Humanity Union encourages publications that look beyond hostility and division and
            consider how an issue affects people, communities and the wider human experience. Authors
            may disagree strongly. Support claims with evidence where possible, distinguish fact from
            opinion, avoid dehumanizing language, explain consequences, acknowledge uncertainty, and
            consider constructive alternatives.
          </p>
          <p className="hu-body">
            Articles should aim to contribute to understanding rather than hostility, manipulation,
            personal attacks or sensationalism. This is not a requirement of ideological conformity —
            the principle is human dignity, evidence, constructive reasoning, responsibility, and
            respect for others.
          </p>
        </Card>
      ) : null}

      {!isPublishingReady && !isBlockedAuthor ? (
        <section className="authoring-page__categories" aria-labelledby="authoring-categories-title">
          <h2 id="authoring-categories-title" className="hu-heading-3">
            Publication categories
          </h2>
          <p className="hu-body authoring-page__muted">
            Guidance only — preferred categories do not restrict what you may later publish.
          </p>
          <div className="authoring-page__category-grid">
            {BLOG_CATEGORIES.map((category) => (
              <Card key={category.categoryId} className="authoring-page__category-card">
                <h3 className="hu-heading-4">{category.name}</h3>
                <p className="hu-body">{CATEGORY_GUIDANCE[category.categoryId]}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {showForm ? (
        <Card className="authoring-page__card">
          <h2 className="hu-heading-3">
            {state.canResubmit ? "Update your application" : "Author application"}
          </h2>
          <form className="authoring-page__form" onSubmit={handleSubmit} noValidate>
            <div className="authoring-page__field">
              <label htmlFor="authoring-motivation">
                Why would you like to contribute to the Humanity Union Blog?
              </label>
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
              <label htmlFor="authoring-topics">What topics would you like to write about?</label>
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
              <label htmlFor="authoring-previous">
                Optional example or link to previous writing
              </label>
              <input
                id="authoring-previous"
                className="hu-form-control"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={previousWritingUrl}
                onChange={(event) => setPreviousWritingUrl(event.target.value)}
              />
            </div>

            <fieldset className="authoring-page__fieldset">
              <legend>Preferred Blog categories</legend>
              <p className="hu-body authoring-page__muted" id="authoring-categories-help">
                Select one or more. This is an interest signal only.
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
              <span>
                I agree that publications must follow platform Safety and publishing standards.
              </span>
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
                ? "Submitting…"
                : submitPhase === "success"
                  ? "Submitted"
                  : state.canResubmit
                    ? "Resubmit application"
                    : "Submit application"}
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

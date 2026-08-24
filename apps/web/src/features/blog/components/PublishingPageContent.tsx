"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { BlogAuthoringAccessState } from "@hu/types";

import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
} from "../../../lib/api-client";
import { fetchBlogAuthoringAccessState } from "../authoring-api";
import { PublishingDashboard } from "./PublishingDashboard";

function isAuthorCapable(state: BlogAuthoringAccessState): boolean {
  return (
    state.presentation === "author" ||
    state.presentation === "trusted_author" ||
    state.presentation === "editor" ||
    state.presentation === "administrator" ||
    state.capabilities.includes("author") ||
    state.capabilities.includes("trusted_author") ||
    state.capabilities.includes("editor") ||
    state.capabilities.includes("administrator")
  );
}

export function PublishingPageContent() {
  const [state, setState] = useState<BlogAuthoringAccessState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBlogAuthoringAccessState()
      .then((access) => {
        if (!cancelled) {
          setState(access);
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        if (isAuthenticationRequiredError(loadError)) {
          setError("Sign in to open the Publishing Workspace.");
          return;
        }
        setError(formatAuthFormError(loadError));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <StatusBanner title="Publishing unavailable" message={error} />;
  }

  if (!state) {
    return <p className="hu-body">Checking Author access…</p>;
  }

  if (!isAuthorCapable(state)) {
    return (
      <div className="publishing-page__gate">
        <StatusBanner
          title="Author access required"
          message="Publishing is available after you become a Blog Author."
        />
        <p className="hu-body">
          <Link href="/workspace/authoring" className="hu-button hu-button--primary">
            Become an Author
          </Link>
        </p>
      </div>
    );
  }

  // Pack 16H — Trusted Publishing bypasses manual review on submit/publish only.
  // It must NOT grant in-place Edit of published posts (that remains trusted_author/editor/admin).
  const canDirectPublish =
    state.capabilities.includes("trusted_author") ||
    state.capabilities.includes("editor") ||
    state.capabilities.includes("administrator") ||
    state.presentation === "trusted_author" ||
    state.presentation === "editor" ||
    state.presentation === "administrator";

  const mutationsDisabled =
    state.presentation === "author_blocked" || state.authorAdministrativelyBlocked === true;

  return (
    <div className="publishing-page">
      <PublishingDashboard
        canDirectPublish={canDirectPublish}
        mutationsDisabled={mutationsDisabled}
      />
    </div>
  );
}

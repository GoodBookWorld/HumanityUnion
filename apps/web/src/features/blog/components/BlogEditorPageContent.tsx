"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { BlogAuthoringAccessState, BlogAuthorWorkspacePost } from "@hu/types";

import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
  isNotFoundError,
} from "../../../lib/api-client";
import { fetchBlogAuthoringAccessState } from "../authoring-api";
import { fetchBlogWorkspacePost } from "../publishing-api";
import { BlogPostEditor } from "./BlogPostEditor";

function isAuthorCapable(state: BlogAuthoringAccessState): boolean {
  return (
    state.capabilities.includes("author") ||
    state.capabilities.includes("trusted_author") ||
    state.capabilities.includes("editor") ||
    state.capabilities.includes("administrator")
  );
}

/** Capability-tier in-place publish/edit (Trusted Author / Editor / Admin). */
function canInPlacePublish(state: BlogAuthoringAccessState): boolean {
  return (
    state.capabilities.includes("trusted_author") ||
    state.capabilities.includes("editor") ||
    state.capabilities.includes("administrator")
  );
}

/**
 * Draft Publish button / submit bypass UI.
 * Pack 16G Trusted Publishing OR capability-tier direct publish.
 * Does not grant in-place published Edit (see PublishingPageContent).
 */
function canBypassManualReviewOnDraft(state: BlogAuthoringAccessState): boolean {
  return canInPlacePublish(state) || state.publishWithoutManualReview === true;
}

export function BlogEditorPageContent(props: { postId?: string; mode: "create" | "edit" }) {
  const t = useTranslations("workspace.publishingPage");
  const [access, setAccess] = useState<BlogAuthoringAccessState | null>(null);
  const [post, setPost] = useState<BlogAuthorWorkspacePost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const accessState = await fetchBlogAuthoringAccessState();
        if (cancelled) {
          return;
        }
        setAccess(accessState);

        if (!isAuthorCapable(accessState)) {
          setError(t("editor.gate.authorRequired"));
          return;
        }

        if (props.mode === "edit" && props.postId) {
          const workspacePost = await fetchBlogWorkspacePost(props.postId);
          if (!cancelled) {
            setPost(workspacePost);
          }
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        if (isAuthenticationRequiredError(loadError)) {
          setError(t("editor.gate.signIn"));
        } else if (isNotFoundError(loadError)) {
          setError(t("editor.gate.notFoundBody"));
        } else {
          setError(formatAuthFormError(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [props.mode, props.postId, t]);

  if (loading) {
    return <p className="hu-body">{t("editor.gate.loading")}</p>;
  }

  if (error || !access || !isAuthorCapable(access)) {
    return (
      <div className="publishing-page__gate">
        <StatusBanner
          title={t("editor.gate.unavailableTitle")}
          message={error ?? t("editor.gate.authorRequiredEdit")}
        />
        <p className="hu-body">
          <Link href="/workspace/authoring" className="hu-button hu-button--primary">
            {t("editor.gate.openAuthoring")}
          </Link>
        </p>
      </div>
    );
  }

  if (props.mode === "edit" && !post) {
    return (
      <StatusBanner
        title={t("editor.gate.notFoundTitle")}
        message={t("editor.gate.loadFailed")}
      />
    );
  }

  return (
    <BlogPostEditor
      mode={props.mode}
      initialPost={post}
      canDirectPublish={canBypassManualReviewOnDraft(access)}
    />
  );
}

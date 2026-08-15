"use client";

import Link from "next/link";
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

function canDirectPublish(state: BlogAuthoringAccessState): boolean {
  return (
    state.capabilities.includes("trusted_author") ||
    state.capabilities.includes("editor") ||
    state.capabilities.includes("administrator")
  );
}

export function BlogEditorPageContent(props: { postId?: string; mode: "create" | "edit" }) {
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
          setError("Author access required.");
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
          setError("Sign in to open the Publishing editor.");
        } else if (isNotFoundError(loadError)) {
          setError("This publication could not be found, or you do not have access.");
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
  }, [props.mode, props.postId]);

  if (loading) {
    return <p className="hu-body">Loading editor…</p>;
  }

  if (error || !access || !isAuthorCapable(access)) {
    return (
      <div className="publishing-page__gate">
        <StatusBanner
          title="Editor unavailable"
          message={error ?? "Author access is required to edit publications."}
        />
        <p className="hu-body">
          <Link href="/workspace/authoring" className="hu-button hu-button--primary">
            Open Authoring
          </Link>
        </p>
      </div>
    );
  }

  if (props.mode === "edit" && !post) {
    return <StatusBanner title="Not found" message="This publication could not be loaded." />;
  }

  return (
    <BlogPostEditor
      mode={props.mode}
      initialPost={post}
      canDirectPublish={canDirectPublish(access)}
    />
  );
}

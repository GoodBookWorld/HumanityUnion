"use client";

import { useEffect, useState } from "react";

import type { BlogReactionKind, PublicBlogPostDetail } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
  isForbiddenError,
} from "../../../lib/api-client";
import { setBlogPostReaction } from "../interaction-api";

export function BlogReactionControls({
  slug,
  initialHelpful,
  initialNotHelpful,
  initialCurrent,
}: {
  slug: string;
  initialHelpful: number;
  initialNotHelpful: number;
  initialCurrent?: PublicBlogPostDetail["currentUserReaction"];
}) {
  const [helpful, setHelpful] = useState(initialHelpful);
  const [notHelpful, setNotHelpful] = useState(initialNotHelpful);
  const [current, setCurrent] = useState<BlogReactionKind | "none">(
    initialCurrent ?? "none",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  useEffect(() => {
    setHelpful(initialHelpful);
    setNotHelpful(initialNotHelpful);
    setCurrent(initialCurrent ?? "none");
  }, [initialHelpful, initialNotHelpful, initialCurrent]);

  async function react(next: BlogReactionKind) {
    setBusy(true);
    setError(null);
    setNeedsSignIn(false);
    try {
      const summary = await setBlogPostReaction({
        slug,
        reaction: current === next ? "none" : next,
      });
      setHelpful(summary.helpful);
      setNotHelpful(summary.notHelpful);
      setCurrent(summary.currentUserReaction);
    } catch (reactError: unknown) {
      if (isAuthenticationRequiredError(reactError) || isForbiddenError(reactError)) {
        setNeedsSignIn(true);
        setError("Sign in to react to this publication.");
      } else {
        setError(formatAuthFormError(reactError));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="blog-reactions" aria-labelledby="blog-reactions-heading">
      <h2 id="blog-reactions-heading" className="hu-heading-2">
        Was this publication helpful?
      </h2>
      <p className="hu-caption">
        Reactions describe the publication — not Author quality or reputation.
      </p>
      <div className="blog-reactions__actions hu-form-actions">
        <Button
          type="button"
          variant={current === "helpful" ? "primary" : "secondary"}
          disabled={busy}
          aria-pressed={current === "helpful"}
          aria-label={`Helpful. ${helpful} ${helpful === 1 ? "reaction" : "reactions"}.`}
          onClick={() => void react("helpful")}
        >
          Helpful {helpful}
        </Button>
        <Button
          type="button"
          variant={current === "not_helpful" ? "primary" : "secondary"}
          disabled={busy}
          aria-pressed={current === "not_helpful"}
          aria-label={`Not Helpful. ${notHelpful} ${notHelpful === 1 ? "reaction" : "reactions"}.`}
          onClick={() => void react("not_helpful")}
        >
          Not Helpful {notHelpful}
        </Button>
      </div>
      {needsSignIn ? (
        <p className="hu-body">
          <a href="/login">Sign in</a> to react.
        </p>
      ) : null}
      {error && !needsSignIn ? (
        <p className="hu-body" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

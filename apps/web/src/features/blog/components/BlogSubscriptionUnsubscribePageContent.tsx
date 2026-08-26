"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { unsubscribePublicBlogSubscription } from "../blog-subscription-api";

/**
 * Pack 21A — public unsubscribe landing (token from email link).
 */
export function BlogSubscriptionUnsubscribePageContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"working" | "success" | "error">("working");
  const [message, setMessage] = useState("Updating your subscription…");

  useEffect(() => {
    let cancelled = false;
    if (!token.trim()) {
      setStatus("error");
      setMessage("This link is invalid or has expired.");
      return;
    }
    void unsubscribePublicBlogSubscription(token)
      .then((result) => {
        if (!cancelled) {
          setStatus("success");
          setMessage(result.message);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            error instanceof Error && error.message.trim()
              ? error.message
              : "This link is invalid or has expired.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="blog-page hu-page-container">
      <header className="blog-page__header">
        <h1 className="hu-heading-1">Blog subscription</h1>
      </header>
      <p className="hu-body" role={status === "error" ? "alert" : "status"}>
        {message}
      </p>
      <p className="hu-caption">
        <Link href="/blog">Return to Blog</Link>
      </p>
    </main>
  );
}

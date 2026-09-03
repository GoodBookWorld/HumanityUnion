"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { confirmPublicBlogSubscription } from "../blog-subscription-api";

/**
 * Pack 21A — public confirmation landing (token from email link).
 */
export function BlogSubscriptionConfirmPageContent() {
  const t = useTranslations("blogPublic.subscriptionPages");
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [status, setStatus] = useState<"working" | "success" | "error">("working");
  const [message, setMessage] = useState(() => t("confirming"));

  useEffect(() => {
    let cancelled = false;
    if (!token.trim()) {
      setStatus("error");
      setMessage(t("invalidLink"));
      return;
    }
    setStatus("working");
    setMessage(t("confirming"));
    void confirmPublicBlogSubscription(token)
      .then((result) => {
        if (!cancelled) {
          setStatus("success");
          // API_OPAQUE — success copy comes from the API response.
          setMessage(result.message);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus("error");
          setMessage(
            error instanceof Error && error.message.trim()
              ? error.message
              : t("invalidLink"),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  return (
    <main className="blog-page hu-page-container">
      <header className="blog-page__header">
        <h1 className="hu-heading-1">{t("title")}</h1>
      </header>
      <p className="hu-body" role={status === "error" ? "alert" : "status"}>
        {message}
      </p>
      <p className="hu-caption">
        <Link href="/blog">{t("returnToBlog")}</Link>
      </p>
    </main>
  );
}

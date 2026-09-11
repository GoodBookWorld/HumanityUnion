"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { BlogAuthoringAccessState } from "@hu/types";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
} from "../../../lib/api-client";
import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant/components/HumanityUnionAssistantWidget";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import { fetchBlogAuthoringAccessState } from "../authoring-api";
import { PublishingDashboard } from "./PublishingDashboard";

import "../publishing.css";

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

function PublishingPageBody() {
  const t = useTranslations("workspace.publishingPage");
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
          setError(t("signInOpen"));
          return;
        }
        setError(formatAuthFormError(loadError));
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (error) {
    return <StatusBanner title={t("unavailableTitle")} message={error} />;
  }

  if (!state) {
    return <p className="hu-body">{t("checkingAccess")}</p>;
  }

  if (!isAuthorCapable(state)) {
    return (
      <div className="publishing-page__gate">
        <StatusBanner title={t("authorRequiredTitle")} message={t("authorRequiredBody")} />
        <p className="hu-body">
          <Link href="/workspace/authoring" className="hu-button hu-button--primary">
            {t("becomeAuthor")}
          </Link>
        </p>
      </div>
    );
  }

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

/** Client shell — page chrome + Publishing dashboard via WEB_UI. */
export function PublishingWorkspacePage() {
  const t = useTranslations("workspace.publishingPage");

  return (
    <main className="humanity-workspace-page">
      <MemberWorkspace
        title={t("title")}
        subtitle={t("subtitle")}
        workspaceNavigation={<WorkspaceNavigation />}
        assistant={
          <HumanityUnionAssistantWidget
            surfaceId="blog"
            description={t("assistantDescription")}
          />
        }
      >
        <PublishingPageBody />
      </MemberWorkspace>
    </main>
  );
}

/** @deprecated Prefer PublishingWorkspacePage for localized chrome. */
export function PublishingPageContent() {
  return <PublishingPageBody />;
}

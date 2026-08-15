"use client";

import { useEffect, useState } from "react";

import { isFirstWorkspaceVisit, markWorkspaceVisited } from "../workspace-first-visit";

import "./workspace-welcome-banner.css";

interface WorkspaceWelcomeBannerProps {
  workspaceReadiness: {
    status: "ready" | "missing";
    missing: string[];
  };
}

/**
 * Recovery Task 33 — Workspace UX Evolution, Part 6.
 *
 * Two presentation modes, chosen purely on the frontend (see
 * `workspace-first-visit.ts` for why). Content is intentionally exactly the
 * copy specified for this task — this is a UX/copy change only, no backend
 * signal or lifecycle logic is involved.
 *
 * Deliberately does not repeat notification counts/links (those remain
 * reachable only via the header bell icon and the Notifications page/
 * section, per this task's explicit "do not duplicate" instruction).
 */
export function WorkspaceWelcomeBanner({ workspaceReadiness }: WorkspaceWelcomeBannerProps) {
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);

  useEffect(() => {
    setFirstVisit(isFirstWorkspaceVisit());
    markWorkspaceVisited();
  }, []);

  if (firstVisit === null) {
    return null;
  }

  return (
    <div className="workspace-welcome-banner">
      <div className="workspace-welcome-banner__accent" aria-hidden="true" />
      <div className="workspace-welcome-banner__body">
        {firstVisit ? (
          <>
            <h2 className="workspace-welcome-banner__title">Welcome to Humanity Union</h2>
            <p className="workspace-welcome-banner__text">
              You are now part of a global community of people who want to improve society through
              cooperation.
            </p>
            <p className="workspace-welcome-banner__lead">Before you begin:</p>
            <ul className="workspace-welcome-banner__list">
              <li>
                Complete your profile so other participants can better understand your experience.
              </li>
              <li>
                Choose your Preferences to discover initiatives and connect with people who share
                your interests.
              </li>
              <li>
                Select your Participation Area. It does not have to be the country where you
                currently live — it is the community where you want to contribute.
              </li>
            </ul>
            <p className="workspace-welcome-banner__text">
              When you&apos;re ready, start your first initiative or join an existing one.
            </p>
          </>
        ) : (
          <>
            <h2 className="workspace-welcome-banner__title">Welcome back.</h2>
            <p className="workspace-welcome-banner__text">
              Thank you for your continued civic participation and social responsibility. We are
              glad to have you back.
            </p>
          </>
        )}
        {workspaceReadiness.status === "missing" && workspaceReadiness.missing.length > 0 ? (
          <p className="workspace-welcome-banner__still-needed">
            Still needed: {workspaceReadiness.missing.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

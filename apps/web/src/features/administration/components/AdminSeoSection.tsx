"use client";

import Link from "next/link";

import type { AuthUserPublic } from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import {
  resolvePlatformIndexingMode,
  shouldDisallowSearchIndexing,
} from "../../../lib/platform-indexing";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";

interface AdminSeoSectionProps {
  user: AuthUserPublic;
}

/**
 * SEO diagnostics from existing Web configuration — no ad-hoc SEO settings store.
 */
export function AdminSeoSection({ user: _user }: AdminSeoSectionProps) {
  const indexingMode = resolvePlatformIndexingMode();
  const disallowIndexing = shouldDisallowSearchIndexing();

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="SEO status / diagnostics">
        <ProfileField label="Resolved indexing mode" value={indexingMode} />
        <ProfileField
          label="Search indexing"
          value={disallowIndexing ? "Disallowed (noindex)" : "Allowed"}
        />
        <ProfileField
          label="Driver"
          value="NEXT_PUBLIC_PLATFORM_MODE / PLATFORM_MODE (env), not a runtime admin setting"
        />
        <p className="hu-caption admin-panel__note">
          Root layout and `robots.ts` mirror `shouldDisallowSearchIndexing()`. Staging and
          development disallow indexing; production remains indexable. Beta mode currently
          remains indexable under the existing helper.
        </p>
      </ProfileSection>

      <ProfileSection title="Existing SEO surfaces">
        <ul className="admin-panel__links">
          <li>
            <Link className="admin-panel__link" href="/robots.txt">
              robots.txt
            </Link>
            <span className="hu-caption"> — generated from platform indexing helper</span>
          </li>
          <li>
            <span className="hu-body">Root metadata</span>
            <span className="hu-caption">
              {" "}
              — title, description, robots in `app/layout.tsx`
            </span>
          </li>
          <li>
            <Link className="admin-panel__link" href="/blog">
              Blog publications
            </Link>
            <span className="hu-caption">
              {" "}
              — per-post Open Graph / canonical via `app/blog/[slug]/page.tsx`
            </span>
          </li>
        </ul>
      </ProfileSection>

      <ProfileSection title="Gaps (next pack recommendations)">
        <ul className="admin-panel__gap-list hu-body">
          <li>No `sitemap.xml` / `sitemap.ts` generation yet.</li>
          <li>No shared JSON-LD / structured data helper.</li>
          <li>Blog SEO title/description fields are deferred in authoring UX.</li>
          <li>
            No canonical runtime SEO settings domain/API — do not invent an ad-hoc config
            store. Follow-up: a narrow platform metadata settings model if centralized
            editable SEO is required.
          </li>
        </ul>
      </ProfileSection>
    </div>
  );
}

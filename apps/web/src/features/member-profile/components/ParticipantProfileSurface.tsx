import Link from "next/link";

import type { PublicMemberProfile, PublicMemberProfileHiddenSections } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { DirectMessageAction } from "../../direct-messaging/components/DirectMessageAction";
import { MemberProfessionalLinksDisplay } from "./MemberProfessionalLinksSection";
import {
  buildIdentityMetaLines,
  buildParticipationAreaLabels,
  buildVisibleStatisticCards,
  hasAnyStatistic,
  hasVisibleBiography,
  hasVisibleOrganization,
  hasVisibleParticipationArea,
  hasVisibleProfessionalLinks,
  hasVisibleRecentInitiatives,
  hasVisibleSkills,
  PUBLIC_MEMBER_BADGE_ALT,
  PUBLIC_MEMBER_BADGE_SIZE_PX,
  PUBLIC_MEMBER_BADGE_SRC,
  resolveDisplayName,
  shouldShowMemberBadge,
  shouldShowOwnerHiddenSectionNotice,
} from "../participant-profile-surface-presentation";

import "../../personal-statistics/personal-statistics.css";
import "./participant-profile-surface.css";

/**
 * Profile UX Pack 03.3 — the one shared visual structure for both:
 *
 * - `/member/{publicName}` (`mode="public"`) — a visitor's exact view;
 * - `/profile` (`mode="owner_preview"`) — the signed-in owner's preview of
 *   that same exact view.
 *
 * Launch Readiness UX Fix Pack 01 — identity information order, Member badge,
 * and Participation Area / Skills under statistics. Renders only fields the
 * public projection already supplies (Privacy boundary stays server-side).
 */
export type ParticipantProfileSurfaceMode = "public" | "owner_preview";

export interface ParticipantProfileOwnerActionLinks {
  /** Profile UX Pack 03.3 Part 9 — used only by the empty-biography prompt. */
  editProfileHref: string;
  /** Profile UX Pack 03.3 Part 5 — used only by hidden-section notices. */
  managePrivacyHref: string;
}

export interface ParticipantProfileSurfaceProps {
  mode: ParticipantProfileSurfaceMode;
  profile: PublicMemberProfile;
  /** Required (and only meaningful) in `owner_preview` mode. */
  hiddenSections?: PublicMemberProfileHiddenSections;
  /** Required (and only meaningful) in `owner_preview` mode. */
  ownerActionLinks?: ParticipantProfileOwnerActionLinks;
  /**
   * Route-specific trailing content rendered as the last row inside this
   * surface's own centered grid (e.g. the public route's "Back to Home"
   * link). Keeps that route-specific element sharing the exact same
   * spacing rhythm as every other row without the surface itself knowing
   * anything about the route that placed it there.
   */
  footer?: React.ReactNode;
}

/** Part 8 — three horizontal Participation Statistics cards, only the fields Privacy allows. */
function ParticipantStatisticsRow({
  cards,
}: {
  cards: ReturnType<typeof buildVisibleStatisticCards>;
}) {
  return (
    <ul className="personal-statistics__grid" aria-label="Participation statistics">
      {cards.map((card) => (
        <li key={card.key} className="personal-statistics__card">
          <img
            className="personal-statistics__icon"
            src={card.iconSrc}
            alt=""
            aria-hidden="true"
            width={40}
            height={40}
          />
          <p className="personal-statistics__value">{card.value}</p>
          <p className="personal-statistics__label">{card.label}</p>
        </li>
      ))}
    </ul>
  );
}

function OwnerHiddenSectionNotice({
  text,
  managePrivacyHref,
}: {
  text: string;
  managePrivacyHref: string;
}) {
  return (
    <p className="public-member-page__owner-notice">
      {text}
      <Link href={managePrivacyHref}>Manage Privacy</Link>
    </p>
  );
}

export function ParticipantProfileSurface({
  mode,
  profile,
  hiddenSections,
  ownerActionLinks,
  footer,
}: ParticipantProfileSurfaceProps) {
  const isOwnerPreview = mode === "owner_preview";
  const displayName = resolveDisplayName(profile);
  const metaLines = buildIdentityMetaLines(profile);
  const statisticCards = buildVisibleStatisticCards(profile.statistics);
  const hasStatistics = hasAnyStatistic(profile.statistics);
  const hasBiography = hasVisibleBiography(profile);
  const hasOrganization = hasVisibleOrganization(profile);
  const hasSkills = hasVisibleSkills(profile);
  const hasLinks = hasVisibleProfessionalLinks(profile);
  const hasParticipationArea = hasVisibleParticipationArea(profile);
  const participationAreaLabels = buildParticipationAreaLabels(profile.participationArea);
  const hasRecentInitiatives = hasVisibleRecentInitiatives(profile);
  const showMemberBadge = shouldShowMemberBadge(profile);

  const showStatisticsNotice =
    isOwnerPreview && shouldShowOwnerHiddenSectionNotice(hasStatistics, hiddenSections?.statistics);
  const showBiographyNotice =
    isOwnerPreview && shouldShowOwnerHiddenSectionNotice(hasBiography, hiddenSections?.biography);
  const showSkillsNotice =
    isOwnerPreview && shouldShowOwnerHiddenSectionNotice(hasSkills, hiddenSections?.skills);
  const showLinksNotice =
    isOwnerPreview &&
    shouldShowOwnerHiddenSectionNotice(hasLinks, hiddenSections?.professionalLinks);
  const showInitiativesNotice =
    isOwnerPreview &&
    shouldShowOwnerHiddenSectionNotice(hasRecentInitiatives, hiddenSections?.recentPublicInitiatives);

  const showStatisticsColumn =
    hasStatistics ||
    showStatisticsNotice ||
    hasParticipationArea ||
    hasSkills ||
    showSkillsNotice;
  const showInitiativesSection = hasRecentInitiatives || showInitiativesNotice;

  return (
    <div className="public-member-page">
      <div
        className={
          showStatisticsColumn
            ? "public-member-page__top-row"
            : "public-member-page__top-row public-member-page__top-row--single"
        }
      >
        <section className="public-member-page__identity">
          {showMemberBadge ? (
            <img
              className="public-member-page__member-badge"
              src={PUBLIC_MEMBER_BADGE_SRC}
              alt={PUBLIC_MEMBER_BADGE_ALT}
              width={PUBLIC_MEMBER_BADGE_SIZE_PX}
              height={PUBLIC_MEMBER_BADGE_SIZE_PX}
            />
          ) : null}

          <div className="public-member-page__identity-body">
            <HumanityAvatar
              className="public-member-page__avatar"
              avatarUrl={profile.avatarUrl}
              size={96}
              alt=""
            />
            <div className="public-member-page__identity-text">
              <h1 className="public-member-page__title">{displayName}</h1>
              <p className="public-member-page__subtitle">@{profile.publicName}</p>
              {metaLines.length > 0 ? (
                <div className="public-member-page__meta-group">
                  {metaLines.map((line) => (
                    <p key={line} className="public-member-page__meta">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
            {/*
             * Communication UX Pack 03.2 Part 6 — a flex sibling of the
             * avatar/text group (not nested inside `identity-text`) so
             * `margin-left: auto` places it on the right side of the
             * identity card on desktop/tablet, while the identity card's
             * own mobile breakpoint (which switches to a column layout)
             * naturally drops it below the identity metadata instead.
             */}
            {mode === "public" ? (
              <div className="public-member-page__message-action">
                <DirectMessageAction publicName={profile.publicName} displayName={displayName} />
              </div>
            ) : null}
          </div>

          {/*
           * Launch Readiness UX Fix Pack 01 — identity information zone:
           * Identity Body → Professional Links → Biography → Organization.
           * Empty optional blocks are omitted entirely.
           */}
          {hasLinks || showLinksNotice ? (
            <div className="public-member-page__identity-info" id="professional-links">
              <h2 className="public-member-page__identity-info-heading">Professional Links</h2>
              {hasLinks ? (
                <MemberProfessionalLinksDisplay
                  website={profile.website}
                  linkedinUrl={profile.linkedinUrl}
                />
              ) : (
                <OwnerHiddenSectionNotice
                  text="Professional links are hidden from your public profile."
                  managePrivacyHref={ownerActionLinks!.managePrivacyHref}
                />
              )}
            </div>
          ) : null}

          {hasBiography || showBiographyNotice || isOwnerPreview ? (
            <div className="public-member-page__identity-info" id="biography">
              <h2 className="public-member-page__identity-info-heading">Biography</h2>
              {hasBiography ? (
                <p className="public-member-page__biography-text">{profile.biography}</p>
              ) : showBiographyNotice ? (
                <OwnerHiddenSectionNotice
                  text="Biography is hidden from your public profile."
                  managePrivacyHref={ownerActionLinks!.managePrivacyHref}
                />
              ) : isOwnerPreview ? (
                <p className="public-member-page__owner-empty-prompt">
                  Add a biography to introduce yourself to collaborators.
                  <Link href={ownerActionLinks!.editProfileHref}>Edit Profile</Link>
                </p>
              ) : null}
            </div>
          ) : null}

          {hasOrganization ? (
            <div className="public-member-page__identity-info" id="organization">
              <h2 className="public-member-page__identity-info-heading">Organization</h2>
              <p className="public-member-page__organization-text">{profile.organization}</p>
            </div>
          ) : null}
        </section>

        {showStatisticsColumn ? (
          <section
            className="public-member-page__statistics"
            aria-label="Participation Statistics"
          >
            <h2 className="public-member-page__section-heading">Participation Statistics</h2>
            {hasStatistics ? (
              <ParticipantStatisticsRow cards={statisticCards} />
            ) : showStatisticsNotice ? (
              <OwnerHiddenSectionNotice
                text="Participation Statistics are hidden from your public profile."
                managePrivacyHref={ownerActionLinks!.managePrivacyHref}
              />
            ) : null}

            {hasParticipationArea ? (
              <div
                className="public-member-page__profile-context"
                id="participation-area"
              >
                <h3 className="public-member-page__profile-context-heading">
                  Participation Area
                </h3>
                <ul
                  className="public-member-page__context-chips"
                  aria-label="Participation Area"
                >
                  {participationAreaLabels.map((label) => (
                    <li key={label} className="public-member-page__context-chip">
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {hasSkills || showSkillsNotice ? (
              <div className="public-member-page__profile-context" id="skills">
                <h3 className="public-member-page__profile-context-heading">Skills</h3>
                {hasSkills ? (
                  <ul className="public-member-page__skills-list" aria-label="Skills">
                    {profile.skills?.map((skill) => (
                      <li key={skill} className="public-member-page__skill-tag">
                        {skill}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <OwnerHiddenSectionNotice
                    text="Skills are hidden from your public profile."
                    managePrivacyHref={ownerActionLinks!.managePrivacyHref}
                  />
                )}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {showInitiativesSection ? (
        <ProfileSection title="Recent Public Initiatives" id="recent-public-initiatives">
          {hasRecentInitiatives ? (
            <ul
              className="public-member-page__initiatives-list"
              aria-label="Recent public initiatives"
            >
              {profile.recentPublicInitiatives?.map((initiative) => (
                <li key={initiative.initiativeId} className="public-member-page__initiatives-item">
                  <Link href={initiative.href}>{initiative.title}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <OwnerHiddenSectionNotice
              text="Recent Public Initiatives are hidden from your public profile."
              managePrivacyHref={ownerActionLinks!.managePrivacyHref}
            />
          )}
        </ProfileSection>
      ) : null}

      {footer}
    </div>
  );
}

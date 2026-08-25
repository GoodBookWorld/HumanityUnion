import Link from "next/link";

import type { PublicMemberProfile, PublicMemberProfileHiddenSections } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { DirectMessageAction } from "../../direct-messaging/components/DirectMessageAction";
import { MemberProfessionalLinksDisplay } from "./MemberProfessionalLinksSection";
import { RecentPublicInitiativesDisclosure } from "./RecentPublicInitiativesDisclosure";
import {
  buildIdentityMetaLines,
  buildVisibleStatisticCards,
  hasAnyStatistic,
  hasVisibleBiography,
  hasVisibleOrganization,
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
 * Profile UX Pack 03.3 / Pack 18C / Pack 19C.4 — shared visual structure for
 * `/member/{publicName}` and `/profile` owner preview.
 *
 * Pack 19C.4 / 19C.4D hierarchy:
 * branded hero (Direct Message CTA bottom-right) → info + six statistics →
 * Biography (section background mountains, transparent ~70% copy) → Initiatives.
 */
export type ParticipantProfileSurfaceMode = "public" | "owner_preview";

export interface ParticipantProfileOwnerActionLinks {
  editProfileHref: string;
  managePrivacyHref: string;
}

export interface ParticipantProfileSurfaceProps {
  mode: ParticipantProfileSurfaceMode;
  profile: PublicMemberProfile;
  hiddenSections?: PublicMemberProfileHiddenSections;
  ownerActionLinks?: ParticipantProfileOwnerActionLinks;
  footer?: React.ReactNode;
}

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

function HeadingWithIcon({
  as: Tag,
  className,
  iconSrc,
  children,
}: {
  as: "h2" | "h3";
  className: string;
  iconSrc: string;
  children: React.ReactNode;
}) {
  return (
    <Tag className={className}>
      <img
        className="public-member-page__heading-icon"
        src={iconSrc}
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
      />
      <span>{children}</span>
    </Tag>
  );
}

/**
 * Pack 19C.4 — decorative communication-network layer (desktop/laptop only;
 * CSS hides it on mobile and under prefers-reduced-motion).
 */
function ProfileHeroNetwork() {
  return (
    <svg
      className="public-member-page__hero-network"
      viewBox="0 0 960 220"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <g
        className="public-member-page__hero-network-lines"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      >
        <path d="M32 148 L140 72 L260 156 L400 48 L560 168 L720 64 L900 142" />
        <path d="M80 40 L220 120 L360 36 L520 128 L680 44 L860 110" />
        <path d="M48 180 L200 100 L340 190 L500 90 L660 186 L820 96" />
        <path d="M180 56 L300 90 L420 70 L580 110 L740 80" />
      </g>
      <g className="public-member-page__hero-network-nodes" fill="currentColor">
        <circle cx="140" cy="72" r="2.6" />
        <circle cx="260" cy="156" r="2.2" />
        <circle cx="400" cy="48" r="2.8" />
        <circle cx="560" cy="168" r="2.3" />
        <circle cx="720" cy="64" r="2.7" />
        <circle cx="220" cy="120" r="2.1" />
        <circle cx="520" cy="128" r="2.4" />
        <circle cx="340" cy="190" r="2.2" />
        <circle cx="660" cy="186" r="2.5" />
        <circle cx="420" cy="70" r="2.0" />
      </g>
      <g className="public-member-page__hero-network-signals">
        <circle className="public-member-page__hero-signal public-member-page__hero-signal--a" r="3.2" />
        <circle className="public-member-page__hero-signal public-member-page__hero-signal--b" r="2.6" />
        <circle className="public-member-page__hero-signal public-member-page__hero-signal--c" r="2.8" />
      </g>
    </svg>
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

  const showInfoColumn =
    hasLinks || showLinksNotice || hasOrganization || hasSkills || showSkillsNotice;
  const showStatisticsColumn = hasStatistics || showStatisticsNotice;
  const showBodyRow = showInfoColumn || showStatisticsColumn;
  const showBiographySection = hasBiography || showBiographyNotice || isOwnerPreview;
  const showInitiativesSection = hasRecentInitiatives || showInitiativesNotice;

  return (
    <div className="public-member-page">
      <article className="public-member-page__card hu-surface-raised">
        <header className="public-member-page__hero public-member-page__identity">
          <div className="public-member-page__hero-backdrop" aria-hidden="true">
            <ProfileHeroNetwork />
          </div>

          {showMemberBadge ? (
            <img
              className="public-member-page__member-badge"
              src={PUBLIC_MEMBER_BADGE_SRC}
              alt={PUBLIC_MEMBER_BADGE_ALT}
              width={PUBLIC_MEMBER_BADGE_SIZE_PX}
              height={PUBLIC_MEMBER_BADGE_SIZE_PX}
            />
          ) : null}

          <div className="public-member-page__hero-content public-member-page__identity-body">
            <HumanityAvatar
              className="public-member-page__avatar"
              avatarUrl={profile.avatarUrl}
              size={88}
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
          </div>

          {mode === "public" ? (
            <div className="public-member-page__message-action">
              <DirectMessageAction publicName={profile.publicName} displayName={displayName} />
            </div>
          ) : null}
        </header>

        {showBodyRow ? (
          <div
            className={
              showInfoColumn && showStatisticsColumn
                ? "public-member-page__body-row"
                : "public-member-page__body-row public-member-page__body-row--single"
            }
          >
            {showInfoColumn ? (
              <section className="public-member-page__info" aria-label="Professional information">
                {hasLinks || showLinksNotice ? (
                  <div className="public-member-page__profile-context" id="professional-links">
                    {hasLinks ? (
                      <MemberProfessionalLinksDisplay
                        variant="icons"
                        website={profile.website}
                        linkedinUrl={profile.linkedinUrl}
                        facebookUrl={profile.facebookUrl}
                        youtubeUrl={profile.youtubeUrl}
                        instagramUrl={profile.instagramUrl}
                        xUrl={profile.xUrl}
                      />
                    ) : (
                      <>
                        <h2 className="public-member-page__profile-context-heading">
                          Professional Links
                        </h2>
                        <OwnerHiddenSectionNotice
                          text="Professional links are hidden from your public profile."
                          managePrivacyHref={ownerActionLinks!.managePrivacyHref}
                        />
                      </>
                    )}
                  </div>
                ) : null}

                {hasOrganization ? (
                  <div className="public-member-page__profile-context" id="organization">
                    <HeadingWithIcon
                      as="h2"
                      className="public-member-page__profile-context-heading public-member-page__profile-context-heading--with-icon"
                      iconSrc="/icons/workspace/organization.png"
                    >
                      Organization
                    </HeadingWithIcon>
                    <p className="public-member-page__organization-text">{profile.organization}</p>
                  </div>
                ) : null}

                {hasSkills || showSkillsNotice ? (
                  <div className="public-member-page__profile-context" id="skills">
                    <HeadingWithIcon
                      as="h2"
                      className="public-member-page__profile-context-heading public-member-page__profile-context-heading--with-icon"
                      iconSrc="/icons/workspace/skills.png"
                    >
                      Skills
                    </HeadingWithIcon>
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
              </section>
            ) : null}
          </div>
        ) : null}

        {showBiographySection ? (
          <section className="public-member-page__biography" id="biography">
            <div className="public-member-page__biography-copy">
              <HeadingWithIcon
                as="h2"
                className="public-member-page__section-heading public-member-page__section-heading--with-icon"
                iconSrc="/icons/workspace/biography.png"
              >
                Biography
              </HeadingWithIcon>
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
          </section>
        ) : null}

        {showInitiativesSection ? (
          hasRecentInitiatives && profile.recentPublicInitiatives ? (
            <RecentPublicInitiativesDisclosure initiatives={profile.recentPublicInitiatives} />
          ) : (
            <div className="public-member-page__initiatives" id="recent-public-initiatives">
              <OwnerHiddenSectionNotice
                text="Recent Public Initiatives are hidden from your public profile."
                managePrivacyHref={ownerActionLinks!.managePrivacyHref}
              />
            </div>
          )
        ) : null}
      </article>

      {footer}
    </div>
  );
}

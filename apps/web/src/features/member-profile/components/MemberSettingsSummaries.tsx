"use client";

import type { MemberPreferences, MemberProfile } from "@hu/types";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { getMyPreferences } from "../../preferences/preferences-api";
import { MemberProfessionalLinksDisplay, MemberSkillTags } from "./MemberProfessionalLinksSection";

import "./member-settings-summaries.css";
import "./member-skills-editor.css";

function summarizeList(values: string[], emptyLabel: string): string {
  if (values.length === 0) {
    return emptyLabel;
  }

  if (values.length <= 3) {
    return values.join(", ");
  }

  return `${values.slice(0, 3).join(", ")} (+${values.length - 3} more)`;
}

interface MemberSettingsSummariesProps {
  profile: MemberProfile;
}

export function MemberSettingsSummaries({ profile }: MemberSettingsSummariesProps) {
  const [preferences, setPreferences] = useState<MemberPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void getMyPreferences()
      .then((loaded) => {
        if (!cancelled) {
          setPreferences(loaded);
        }
      })
      .catch((error) => {
        if (!cancelled && !isAuthenticationRequiredError(error)) {
          setPreferences(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p>Loading member settings summaries...</p>;
  }

  if (!preferences) {
    return (
      <ProfileSection title="Member Settings">
        <p>
          <Link href="/preferences">Open Preferences</Link> to configure skills, interests, and
          notification settings.
        </p>
      </ProfileSection>
    );
  }

  return (
    <div className="member-settings-summaries">
      <ProfileSection title="Skills">
        {profile.skills.length > 0 ? (
          <MemberSkillTags skills={profile.skills} />
        ) : (
          <ProfileField label="Skills" value="None added" />
        )}
        <p>
          <a href="#skills">Edit skills</a>
        </p>
      </ProfileSection>

      <ProfileSection title="Professional Links">
        <MemberProfessionalLinksDisplay
          website={profile.website}
          linkedinUrl={profile.linkedinUrl}
          facebookUrl={profile.facebookUrl}
          youtubeUrl={profile.youtubeUrl}
          instagramUrl={profile.instagramUrl}
          xUrl={profile.xUrl}
        />
        {!profile.website &&
        !profile.linkedinUrl &&
        !profile.facebookUrl &&
        !profile.youtubeUrl &&
        !profile.instagramUrl &&
        !profile.xUrl ? (
          <ProfileField label="Links" value="None added" />
        ) : null}
        <p>
          <a href="#professional-links">Edit professional links</a>
        </p>
      </ProfileSection>

      <ProfileSection title="Interests">
        <ProfileField
          label="Expertise areas"
          value={summarizeList(preferences.experiencePreferences.expertiseAreas, "None selected")}
        />
        <ProfileField
          label="Participation interests"
          value={summarizeList(
            preferences.participationPreferences.initiativeParticipationInterests,
            "None selected",
          )}
        />
        <p>
          <Link href="/preferences#experience">Edit interests</Link>
        </p>
      </ProfileSection>

      <ProfileSection title="Participation">
        <ProfileField
          label="Preferred activity areas"
          value={summarizeList(
            preferences.participationPreferences.preferredActivityAreas,
            "None selected",
          )}
        />
        <ProfileField
          label="Contribution willingness"
          value={summarizeList(
            preferences.participationPreferences.contributionWillingness,
            "None selected",
          )}
        />
        <p>
          <Link href="/preferences#participation">Edit participation preferences</Link>
        </p>
      </ProfileSection>

      <ProfileSection title="Visibility">
        <ProfileField label="Skills visibility" value={profile.skillsVisibility} />
        <ProfileField
          label="Professional links visibility"
          value={profile.professionalLinksVisibility}
        />
        <ProfileField
          label="Interests visibility"
          value={preferences.visibilityPreferences.interestsVisibility}
        />
        <p>
          <a href="#privacy">Edit profile visibility</a> ·{" "}
          <Link href="/preferences#visibility">Edit preferences visibility</Link>
        </p>
      </ProfileSection>

      <ProfileSection title="Preferences">
        <ProfileField
          label="Notification frequency"
          value={preferences.communicationPreferences.notificationFrequency.replace("_", " ")}
        />
        <ProfileField
          label="Interest match notifications"
          value={
            preferences.communicationPreferences.interestMatchNotificationsEnabled
              ? "Enabled"
              : "Disabled"
          }
        />
        <p>
          <Link href="/preferences">Open full Preferences form</Link>
        </p>
      </ProfileSection>
    </div>
  );
}

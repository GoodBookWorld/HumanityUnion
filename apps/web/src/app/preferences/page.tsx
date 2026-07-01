import Link from "next/link";

import { ProfileField } from "../../components/member/ProfileField";
import { ProfileSection } from "../../components/member/ProfileSection";
import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";
import { getCurrentPreferences } from "../../features/preferences/preferences-api";

import "./preferences-page.css";

const NAV_ITEMS = ["Experience", "Participation", "Communication", "Accessibility", "Workspace"];

function formatList(values: string[]): string {
  return values.join(", ");
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

export default async function PreferencesPage() {
  let preferences = null;

  try {
    preferences = await getCurrentPreferences();
  } catch {
    preferences = null;
  }

  if (!preferences) {
    return (
      <main className="preferences-page">
        <h1>Preferences Workspace</h1>
        <p>Preferences API is not available.</p>
        <p className="preferences-page__back">
          <Link href="/">Back to Home</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="preferences-page">
      <MemberWorkspace
        title="Preferences"
        subtitle="Your Humanity Union experience preferences"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation current="Preferences" />}
      >
        <ProfileSection title="Experience">
          <ProfileField
            label="Interface Language"
            value={preferences.experiencePreferences.interfaceLanguage}
          />
          <ProfileField
            label="Reading Languages"
            value={formatList(preferences.experiencePreferences.readingLanguages)}
          />
          <ProfileField
            label="Writing Languages"
            value={formatList(preferences.experiencePreferences.writingLanguages)}
          />
          <ProfileField
            label="Translation Preference"
            value={preferences.experiencePreferences.translationPreference}
          />
          <ProfileField label="Time Zone" value={preferences.experiencePreferences.timeZone} />
          <ProfileField label="Date Format" value={preferences.experiencePreferences.dateFormat} />
          <ProfileField label="Time Format" value={preferences.experiencePreferences.timeFormat} />
        </ProfileSection>

        <ProfileSection title="Participation">
          <ProfileField
            label="Interested Topics"
            value={formatList(preferences.participationPreferences.interestedTopics)}
          />
          <ProfileField
            label="Preferred Initiative Types"
            value={formatList(preferences.participationPreferences.preferredInitiativeTypes)}
          />
          <ProfileField
            label="Volunteer Interests"
            value={formatList(preferences.participationPreferences.volunteerInterests)}
          />
          <ProfileField
            label="Preferred Regions"
            value={formatList(preferences.participationPreferences.preferredRegions)}
          />
          <ProfileField
            label="Participation Availability"
            value={preferences.participationPreferences.participationAvailability}
          />
        </ProfileSection>

        <ProfileSection title="Communication">
          <ProfileField
            label="Announcement Preference"
            value={preferences.communicationPreferences.announcementPreference}
          />
          <ProfileField
            label="Invitation Preference"
            value={preferences.communicationPreferences.invitationPreference}
          />
          <ProfileField
            label="Digest Frequency"
            value={preferences.communicationPreferences.digestFrequency}
          />
          <ProfileField
            label="Message Categories"
            value={formatList(preferences.communicationPreferences.messageCategories)}
          />
        </ProfileSection>

        <ProfileSection title="Accessibility">
          <ProfileField label="Font Size" value={preferences.accessibilityPreferences.fontSize} />
          <ProfileField
            label="High Contrast"
            value={formatBoolean(preferences.accessibilityPreferences.highContrast)}
          />
          <ProfileField
            label="Reduced Motion"
            value={formatBoolean(preferences.accessibilityPreferences.reducedMotion)}
          />
          <ProfileField
            label="Screen Reader Support"
            value={formatBoolean(preferences.accessibilityPreferences.screenReaderSupport)}
          />
        </ProfileSection>

        <ProfileSection title="Workspace">
          <ProfileField
            label="Default Start Page"
            value={preferences.workspacePreferences.defaultStartPage}
          />
          <ProfileField
            label="Navigation Style"
            value={preferences.workspacePreferences.navigationStyle}
          />
          <ProfileField
            label="Expanded Sections"
            value={formatList(preferences.workspacePreferences.expandedSections)}
          />
          <ProfileField label="Card Density" value={preferences.workspacePreferences.cardDensity} />
        </ProfileSection>
      </MemberWorkspace>

      <p className="preferences-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}

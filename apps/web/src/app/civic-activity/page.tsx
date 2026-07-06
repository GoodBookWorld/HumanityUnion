import Link from "next/link";

import { MemberWorkspace } from "../../components/member/MemberWorkspace";
import { MyCivicActivitySection } from "../../features/civic-activity/components/MyCivicActivitySection";
import { WorkspaceNavigation } from "../../features/initiatives/components/WorkspaceNavigation";

import "./civic-activity-page.css";

const NAV_ITEMS = ["My Civic Activity", "Activity Summary", "Activity Timeline"];

export default function CivicActivityPage() {
  return (
    <main className="civic-activity-page">
      <MemberWorkspace
        title="My Civic Activity"
        subtitle="Your private civic work across the Humanity Union lifecycle"
        navItems={NAV_ITEMS}
        workspaceNavigation={<WorkspaceNavigation current="My Civic Activity" />}
      >
        <MyCivicActivitySection />
      </MemberWorkspace>

      <p className="civic-activity-page__back">
        <Link href="/">Back to Home</Link>
      </p>
    </main>
  );
}

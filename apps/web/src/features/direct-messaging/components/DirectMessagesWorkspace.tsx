"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MemberWorkspace } from "../../../components/member/MemberWorkspace";
import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { InitiativeGroupChatWorkspace } from "../../initiative-group-chat/components/InitiativeGroupChatWorkspace";
import { WorkspaceNavigation } from "../../initiatives/components/WorkspaceNavigation";
import type { CollaborationTab } from "../../public-initiative-experience/components/InitiativeCollaborationWorkspace";
import type { WorkspaceHomeAllyEntry } from "../../workspace-home/workspace-home-api";
import { fetchActiveAllies } from "../api";
import { DIRECT_MESSAGES_CHANGED_EVENT } from "../direct-messaging-events";
import {
  resolveCollaborationSection,
  resolveCommunicationMode,
  type CommunicationMode,
} from "../direct-messaging-format";

import { ActiveAlliesPanel, type ActiveAlliesPanelState } from "./ActiveAlliesPanel";
import { CommunicationModeSwitch } from "./CommunicationModeSwitch";
import { DirectConversationView } from "./DirectConversationView";
import "./direct-messaging.css";

interface DirectMessagesWorkspaceProps {
  activeConversationId?: string;
}

type PageState = "loading" | "unauthenticated" | "ready";

/**
 * UX Completion Pack 04 Part 2/3/4/5 + Communication UX Pack 03.9 Part 2 —
 * the Workspace "Messages" screen has exactly two modes, both driven
 * entirely by the URL (`?mode=personal|initiative`, plus
 * `?initiativeId=` / `?section=` in Initiative mode) rather than
 * local-only client state, so a direct link, refresh, or notification
 * deep-link always lands on the right screen:
 *
 * - Personal Chat (default, `mode=personal` or omitted) — unchanged from
 *   UX Completion Pack 04: the Messenger (`children`, full main-content
 *   width) and the Active Allies directory (`assistant`), the only
 *   conversation selector, driven by the route
 *   (`/workspace/messages` vs `/workspace/messages/{conversationId}`).
 * - Initiative Group Chat (`mode=initiative`) — a completely separate
 *   `InitiativeGroupChatWorkspace`, which builds its own two-column layout
 *   and is mounted as the full-width `children` with no `assistant`, so
 *   Personal Chat's Active Allies sidebar never appears in Group mode.
 */
export function DirectMessagesWorkspace({ activeConversationId }: DirectMessagesWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = resolveCommunicationMode(searchParams);
  const groupInitiativeId = searchParams.get("initiativeId");
  const groupSection = resolveCollaborationSection(searchParams);

  const [pageState, setPageState] = useState<PageState>("loading");

  /**
   * Part 5/6 — the Active Allies directory is the sole selector, so its
   * data load also gates the whole page's auth state; there is no separate
   * conversation-list fetch to duplicate it (Part 16).
   */
  const [alliesState, setAlliesState] = useState<ActiveAlliesPanelState>("loading");
  const [allies, setAllies] = useState<WorkspaceHomeAllyEntry[]>([]);
  const [alliesCount, setAlliesCount] = useState(0);
  const [alliesErrorMessage, setAlliesErrorMessage] = useState<string | null>(null);

  /**
   * Part 6 — "selected Ally may be visually identified" in the Active
   * Allies directory. Resolved from the open conversation's own detail
   * fetch (already happening in `DirectConversationView`) instead of a
   * second conversation-list request (Part 16).
   */
  const [activeParticipantId, setActiveParticipantId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!activeConversationId) {
      setActiveParticipantId(undefined);
    }
  }, [activeConversationId]);

  const loadAllies = useCallback(async () => {
    try {
      const summary = await fetchActiveAllies();
      setAllies(summary.items);
      setAlliesCount(summary.alliesCount);
      setAlliesState("ready");
      setPageState("ready");
    } catch (error) {
      if (isAuthenticationRequiredError(error)) {
        setPageState("unauthenticated");
        return;
      }

      setAlliesErrorMessage(
        error instanceof Error ? error.message : "Unable to load your Active Allies.",
      );
      setAlliesState("error");
      setPageState("ready");
    }
  }, []);

  /**
   * Communication UX Pack 03.9 Part 2 — Personal Chat's Active Allies load
   * (and the auth gate it doubles as) only matters in Personal mode;
   * `InitiativeGroupChatWorkspace` resolves its own auth/loading state
   * independently, so Group mode never waits on this fetch (Part 17 — no
   * unnecessary request when the Active Allies directory is not shown).
   */
  useEffect(() => {
    if (mode !== "personal") {
      return;
    }

    void loadAllies();
  }, [mode, loadAllies]);

  useEffect(() => {
    if (mode !== "personal") {
      return;
    }

    function handleChanged() {
      void loadAllies();
    }

    window.addEventListener(DIRECT_MESSAGES_CHANGED_EVENT, handleChanged);

    return () => {
      window.removeEventListener(DIRECT_MESSAGES_CHANGED_EVENT, handleChanged);
    };
  }, [mode, loadAllies]);

  const handleModeChange = useCallback(
    (nextMode: CommunicationMode) => {
      if (nextMode === "personal") {
        router.push("/workspace/messages");
        return;
      }

      const params = new URLSearchParams();
      params.set("mode", "initiative");

      if (groupInitiativeId) {
        params.set("initiativeId", groupInitiativeId);
      }

      router.push(`/workspace/messages?${params.toString()}`);
    },
    [router, groupInitiativeId],
  );

  const handleSelectInitiative = useCallback(
    (initiativeId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("mode", "initiative");
      params.set("initiativeId", initiativeId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const handleGroupSectionChange = useCallback(
    (section: CollaborationTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("mode", "initiative");
      params.set("section", section);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const body = (() => {
    if (pageState === "loading") {
      return <p className="direct-messaging__conversation-status" role="status">Loading Messenger…</p>;
    }

    if (pageState === "unauthenticated") {
      return (
        <div className="direct-messaging__empty-state">
          <p className="direct-messaging__empty-title">Sign in to view your conversations.</p>
          <Link href="/login">Sign in</Link>
        </div>
      );
    }

    return (
      <div className="direct-messaging-page">
        <div className="direct-messaging-page__conversation-column">
          {activeConversationId ? (
            <DirectConversationView
              key={activeConversationId}
              conversationId={activeConversationId}
              onConversationChanged={() => void loadAllies()}
              onParticipantResolved={(participant) => setActiveParticipantId(participant.participantId)}
            />
          ) : (
            <div className="direct-messaging-page__empty-state">
              <p className="direct-messaging-page__empty-title">Select an Ally</p>
              <p className="direct-messaging-page__empty-text">
                Choose an Active Ally to open your Direct Collaboration conversation.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  })();

  const headerBar = (
    <header className="member-workspace__header">
      <h1 className="member-workspace__title">Messages</h1>
      <p className="member-workspace__subtitle">
        {mode === "initiative"
          ? "Group communication with your Initiative's Author and Active Allies."
          : "Direct Collaboration conversations with other Participants."}
      </p>
      <CommunicationModeSwitch mode={mode} onChange={handleModeChange} />
    </header>
  );

  if (mode === "initiative") {
    return (
      <MemberWorkspace
        title="Messages"
        headerBar={headerBar}
        workspaceNavigation={<WorkspaceNavigation />}
      >
        <div id="communication-mode-panel" role="tabpanel" aria-labelledby="communication-mode-tab-initiative">
          <InitiativeGroupChatWorkspace
            initiativeId={groupInitiativeId}
            section={groupSection}
            onSelectInitiative={handleSelectInitiative}
            onSectionChange={handleGroupSectionChange}
          />
        </div>
      </MemberWorkspace>
    );
  }

  return (
    <MemberWorkspace
      title="Messages"
      headerBar={headerBar}
      workspaceNavigation={<WorkspaceNavigation />}
      assistant={
        pageState === "unauthenticated" ? undefined : (
          <ActiveAlliesPanel
            state={alliesState}
            allies={allies}
            alliesCount={alliesCount}
            errorMessage={alliesErrorMessage}
            activeParticipantId={activeParticipantId}
          />
        )
      }
    >
      <div id="communication-mode-panel" role="tabpanel" aria-labelledby="communication-mode-tab-personal">
        {body}
      </div>
    </MemberWorkspace>
  );
}

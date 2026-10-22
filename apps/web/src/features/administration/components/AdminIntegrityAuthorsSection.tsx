"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import type { AuthUserPublic } from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import {
  listAdminIntegrityMediaAuthors,
  resolveAdminIntegrityMediaAuthorReply,
} from "../admin-integrity-media-authors-api";
import {
  INTEGRITY_MEDIA_AUTHORS_PAGE_SIZE,
  authorNotificationOpenRequest,
  integrityMediaAuthorDirectoryHref,
  integrityMediaAuthorsNextOffset,
  integrityMediaAuthorsPreviousOffset,
  integrityMediaAuthorsQueryAfterFilter,
  isIntegrityMediaAuthorReplyMessageId,
  type IntegrityMediaAuthorListState,
  type IntegrityMediaAuthorRow,
} from "../admin-integrity-media-authors-model";
import { AdminIntegrityAuthorMessageDialog } from "./AdminIntegrityAuthorMessageDialog";
import { AdminIntegrityAuthorsPanel } from "./AdminIntegrityAuthorsPanel";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-participants-table.css";

interface AdminIntegrityAuthorsSectionProps {
  user: AuthUserPublic;
}

export function AdminIntegrityAuthorsSection({ user }: AdminIntegrityAuthorsSectionProps) {
  return (
    <Suspense
      fallback={
        <div className="admin-panel">
          <AdminPanelNavigation />
          <p className="hu-body">Loading Integrity Authors…</p>
        </div>
      }
    >
      <AdminIntegrityAuthorsSectionInner user={user} />
    </Suspense>
  );
}

function AdminIntegrityAuthorsSectionInner({ user: _user }: AdminIntegrityAuthorsSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openedMessageIdRef = useRef<string | null>(null);
  const pendingMessageIdRef = useRef<string | null>(null);
  const [state, setState] = useState<IntegrityMediaAuthorListState>("all");
  const [offset, setOffset] = useState(0);
  const [authors, setAuthors] = useState<readonly IntegrityMediaAuthorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<IntegrityMediaAuthorRow | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  const loadAuthors = useCallback(async (mode?: { silent?: boolean }) => {
    const silent = mode?.silent === true;
    if (!silent) {
      setPhase("loading");
      setErrorMessage(null);
    }
    try {
      const page = await listAdminIntegrityMediaAuthors({
        state,
        limit: INTEGRITY_MEDIA_AUTHORS_PAGE_SIZE,
        offset,
      });
      setAuthors(page.authors);
      setTotal(page.total);
      setHasMore(page.hasMore);
      setUnreadMessageCount(page.unreadMessageCount);
      setPhase("ready");
    } catch (error: unknown) {
      if (silent) {
        return;
      }
      setAuthors([]);
      setTotal(0);
      setHasMore(false);
      setUnreadMessageCount(0);
      setPhase("error");
      setErrorMessage(
        isForbiddenError(error)
          ? "Integrity Authors requires an Administrator account."
          : formatAuthFormError(error),
      );
    }
  }, [offset, state]);

  useEffect(() => {
    void loadAuthors();
  }, [loadAuthors]);

  useEffect(() => {
    const rawMessageId = searchParams.get("messageId");
    if (!isIntegrityMediaAuthorReplyMessageId(rawMessageId)) {
      pendingMessageIdRef.current = null;
      openedMessageIdRef.current = null;
      return;
    }

    const requested = authorNotificationOpenRequest(rawMessageId, openedMessageIdRef.current);
    if (!requested || pendingMessageIdRef.current === requested) {
      return;
    }

    pendingMessageIdRef.current = requested;
    let cancelled = false;

    void (async () => {
      const row = await resolveAdminIntegrityMediaAuthorReply(requested);
      if (cancelled || pendingMessageIdRef.current !== requested) {
        return;
      }
      pendingMessageIdRef.current = null;
      openedMessageIdRef.current = requested;
      setSendTarget(row?.memberId ? row : null);
    })();

    return () => {
      cancelled = true;
      if (pendingMessageIdRef.current === requested) {
        pendingMessageIdRef.current = null;
      }
    };
  }, [searchParams]);

  function handleCloseDialog() {
    setSendTarget(null);
    if (!searchParams.get("messageId")) {
      pendingMessageIdRef.current = null;
      openedMessageIdRef.current = null;
      return;
    }
    router.replace(integrityMediaAuthorDirectoryHref(pathname, searchParams.toString()), {
      scroll: false,
    });
  }

  function handleStateChange(next: IntegrityMediaAuthorListState) {
    const query = integrityMediaAuthorsQueryAfterFilter(next);
    setState(query.state);
    setOffset(query.offset);
  }

  function handlePrevious() {
    const next = integrityMediaAuthorsPreviousOffset(offset, INTEGRITY_MEDIA_AUTHORS_PAGE_SIZE);
    if (next !== null) {
      setOffset(next);
    }
  }

  function handleNext() {
    const next = integrityMediaAuthorsNextOffset(
      offset,
      INTEGRITY_MEDIA_AUTHORS_PAGE_SIZE,
      hasMore,
    );
    if (next !== null) {
      setOffset(next);
    }
  }

  const handleUnreadCount = useCallback(
    (count: number | null) => {
      if (count !== null) {
        setUnreadMessageCount(count);
      }
      void loadAuthors({ silent: true });
    },
    [loadAuthors],
  );

  const unreadBadge =
    unreadMessageCount > 0 ? (
      <button
        type="button"
        className="admin-integrity-authors__unread-badge"
        aria-label={`${unreadMessageCount} unread author messages. Show authors with unread messages.`}
        onClick={() => handleStateChange("unread")}
      >
        {unreadMessageCount}
      </button>
    ) : null;

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <ProfileSection title="Integrity Authors" headingAccessory={unreadBadge}>
        <AdminIntegrityAuthorsPanel
          phase={phase}
          errorMessage={errorMessage}
          authors={authors}
          state={state}
          offset={offset}
          total={total}
          hasMore={hasMore}
          onStateChange={handleStateChange}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onSend={setSendTarget}
        />
      </ProfileSection>
      {sendTarget ? (
        <AdminIntegrityAuthorMessageDialog
          memberId={sendTarget.memberId}
          participantDisplayName={sendTarget.participantDisplayName}
          canSend={sendTarget.canSend}
          linkState={sendTarget.state}
          authorActivationPending={sendTarget.authorActivationPending}
          collaborationStatus={sendTarget.collaborationStatus}
          isOpen={sendTarget !== null}
          onClose={handleCloseDialog}
          onRefresh={() => {
            void loadAuthors();
          }}
          onUnreadCount={handleUnreadCount}
        />
      ) : null}
    </div>
  );
}

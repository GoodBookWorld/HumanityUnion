"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  InitiativeLifecycleProfile,
  PublicInitiativeCollaborationParticipant,
  PublicInitiativeCollaborationParticipantsResult,
  PublicInitiativeDiscussionComment,
} from "@hu/types";
import { getInitiativeLifecycleProfilePresentation } from "@hu/types";

import { Button, HuFeedbackMessage } from "../../../design-system";
import { getMe } from "../../auth/auth-api";
import { resolveSafeReturnTo } from "../../auth/lib/resolve-safe-return-to";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  expressInitiativeCollaborationInterest,
  fetchInitiativeCollaborationParticipants,
  fetchInitiativeComments,
  inviteCommentAuthorToAllies,
  markCommentAsProposalCandidate,
  postInitiativeComment,
  respondToAlliesInvitation,
  respondToInitiativeCollaborationInterest,
  updateInitiativeCommentReaction,
} from "../api";
import {
  applyCollaborationNotificationScroll,
  applyDiscussionCommentDeepLinkScroll,
  buildCollaborationParticipantDomId,
  buildDiscussionCommentDomId,
  COLLABORATION_LIST_DOM_ID,
  planDiscussionCommentDeepLinkScroll,
  resolveDiscussionCommentFocusTarget,
} from "../discussion-comment-deep-link";
import { useInitiativeExperienceRefresh } from "../initiative-experience-refresh-context";
import {
  DISCUSSION_ACTION_DEFINITIONS,
  DISCUSSION_FILTERS,
  matchesDiscussionFilter,
  resolveAlliesInvitationResponseState,
  resolveAuthorBadges,
  resolveAuthorLinkPresentation,
  resolveCollaborationInvitationAcceptState,
  resolveCollaborationReviewActionState,
  resolveCollaborationStatusLabel,
  resolveFilterHeading,
  resolveInviteToAlliesActionState,
  resolveProposalActionState,
  resolveReadyToCollaborateActionState,
  resolveStatusIndicators,
  type DiscussionFilter,
} from "./discussion-comment-presentation";
import { PublicChoiceDiscussionVotePanel } from "./PublicChoiceDiscussionVotePanel";

/** @deprecated Prefer importing from discussion-comment-deep-link. */
export { COLLABORATION_LIST_DOM_ID };

interface PublicDiscussionPanelProps {
  initiativeId: string;
  initialComments?: PublicInitiativeDiscussionComment[];
  commentCount?: number;
  hasMoreComments?: boolean;
  panelId?: string;
  scopeLabel?: string;
  /**
   * Profile UX Pack 01 Part 4 — allows the collaboration-request
   * notification's "Review request" action to deep-link straight into the
   * Collaboration working list (see `?filter=collaboration` handling in
   * `PublicInitiativeExperiencePage`).
   */
  initialFilter?: DiscussionFilter;
  /**
   * Canonical `#comment-{commentId}` deep-link target. When set, the panel
   * ensures the "all" filter, loads pages until the comment is rendered,
   * then scrolls it into view (no fixed timeouts).
   */
  focusCommentId?: string;
  /**
   * Lifecycle Staging Fix 05D — Ally-row participant id from
   * `?filter=collaboration&participant=…`. Scrolls that exact row once
   * collaboration data has rendered.
   */
  focusCollaborationParticipantId?: string;
  /** Public Choice Experience Pack 01 — profile-aware Discussion presentation. */
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}

const DRAFT_STORAGE_PREFIX = "pie-discussion-draft:";

function buildDiscussionReturnTo(initiativeId: string): string {
  return resolveSafeReturnTo(
    `/initiatives/public/${encodeURIComponent(initiativeId)}#discussion`,
    "/",
  );
}

function formatCommentDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function applyReactionChange(
  comment: PublicInitiativeDiscussionComment,
  nextReaction: "like" | "dislike" | "none",
): PublicInitiativeDiscussionComment {
  const previousReaction = comment.currentUserReaction ?? "none";
  let likes = comment.likes;
  let dislikes = comment.dislikes;

  if (previousReaction === "like") {
    likes = Math.max(0, likes - 1);
  }

  if (previousReaction === "dislike") {
    dislikes = Math.max(0, dislikes - 1);
  }

  if (nextReaction === "like") {
    likes += 1;
  }

  if (nextReaction === "dislike") {
    dislikes += 1;
  }

  return {
    ...comment,
    likes,
    dislikes,
    currentUserReaction: nextReaction,
  };
}

const ICON_BY_ACTION_ID = new Map(
  DISCUSSION_ACTION_DEFINITIONS.map((definition) => [definition.id, definition.icon]),
);

/**
 * UX Evolution Pack 02.3 Part 6/7 — single ordered action row rendered
 * under every comment: Helpful, Not Helpful, Proposal, Ready to
 * Collaborate, Invite to Allies. Helpful/Not Helpful reuse the existing
 * like/dislike reaction pipeline; the remaining three reuse the existing
 * collaboration permission flags computed server-side (canMarkProposal /
 * canReadyToCollaborate / canInviteToAllies / viewerAllyStatus /
 * authorAllyStatus / isViewerInitiativeSteward / isViewerAuthor) — no
 * permission logic changes, only how the already-authorized state is
 * rendered (see discussion-comment-presentation.ts).
 *
 * Completed actions (Proposal Added / Ready to Collaborate /
 * Invitation Pending / Ally / Invitation Sent) are shown muted and
 * disabled rather than hidden, so a participant can always see the result
 * of an action they already took.
 */
function CommentActions({
  initiativeId,
  comment,
  authStatus,
  returnTo,
  onReactionUpdated,
  onCollaborationChanged,
  showStandardParticipationActions = true,
}: {
  initiativeId: string;
  comment: PublicInitiativeDiscussionComment;
  authStatus: ReturnType<typeof useClientAuthStatus>;
  returnTo: string;
  onReactionUpdated: (comment: PublicInitiativeDiscussionComment) => void;
  onCollaborationChanged: () => void;
  showStandardParticipationActions?: boolean;
}) {
  const [reactionBusy, setReactionBusy] = useState(false);
  const [collabAction, setCollabAction] = useState<
    "proposal" | "collaborate" | "invite" | "accept-invitation" | "decline-invitation" | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const currentReaction = comment.currentUserReaction ?? "none";
  const collaboration = comment.collaboration;

  async function handleReaction(nextReaction: "like" | "dislike" | "none"): Promise<void> {
    if (authStatus !== "authenticated") {
      return;
    }

    setReactionBusy(true);

    try {
      await updateInitiativeCommentReaction(initiativeId, comment.commentId, nextReaction);
      onReactionUpdated(applyReactionChange(comment, nextReaction));
    } catch {
      // Keep comment intact if reaction fails.
    } finally {
      setReactionBusy(false);
    }
  }

  async function runCollaborationAction(
    action: "proposal" | "collaborate" | "invite" | "accept-invitation" | "decline-invitation",
    perform: () => Promise<unknown>,
  ): Promise<void> {
    setCollabAction(action);
    setActionError(null);

    try {
      await perform();
      onCollaborationChanged();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "This action could not be completed.",
      );
    } finally {
      setCollabAction(null);
    }
  }

  if (authStatus === "unauthenticated") {
    const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    const registerHref = `/register?returnTo=${encodeURIComponent(returnTo)}`;

    return (
      <div className="pie-discussion__actions pie-discussion__actions--guest">
        <a
          className="pie-discussion__action pie-discussion__action--guest"
          href={loginHref}
          aria-label={`Helpful. ${comment.likes} votes. Sign in to react.`}
        >
          <img
            className="pie-discussion__action-icon"
            src={ICON_BY_ACTION_ID.get("helpful")}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
          />
          <span className="pie-discussion__action-label">Helpful</span>
          <span className="pie-discussion__action-count" aria-hidden="true">
            {comment.likes}
          </span>
        </a>
        <a
          className="pie-discussion__action pie-discussion__action--guest"
          href={loginHref}
          aria-label={`Not helpful. ${comment.dislikes} votes. Sign in to react.`}
        >
          <img
            className="pie-discussion__action-icon"
            src={ICON_BY_ACTION_ID.get("not-helpful")}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
          />
          <span className="pie-discussion__action-label">Not Helpful</span>
          <span className="pie-discussion__action-count" aria-hidden="true">
            {comment.dislikes}
          </span>
        </a>
        <a className="pie-discussion__action-link" href={registerHref}>
          Create Account
        </a>
      </div>
    );
  }

  const proposalState = resolveProposalActionState(collaboration, collabAction === "proposal");
  const readyState = resolveReadyToCollaborateActionState(
    collaboration,
    collabAction === "collaborate",
  );
  const invitationResponseState = resolveAlliesInvitationResponseState(
    collaboration,
    collabAction === "accept-invitation" || collabAction === "decline-invitation",
  );
  const inviteState = resolveInviteToAlliesActionState(collaboration, collabAction === "invite");

  const showProposal = showStandardParticipationActions && proposalState.visible;
  const showReady = showStandardParticipationActions && readyState.visible;
  const showInvitationResponse =
    showStandardParticipationActions && invitationResponseState.visible;
  const showInvite = showStandardParticipationActions && inviteState.visible;

  return (
    <div className="pie-discussion__actions" role="group" aria-label="Comment feedback actions">
      <button
        type="button"
        className={`pie-discussion__action${
          currentReaction === "like" ? " pie-discussion__action--active" : ""
        }`}
        aria-pressed={currentReaction === "like"}
        aria-label={`Helpful. ${comment.likes} votes.`}
        disabled={reactionBusy}
        onClick={() => void handleReaction(currentReaction === "like" ? "none" : "like")}
      >
        <img
          className="pie-discussion__action-icon"
          src={ICON_BY_ACTION_ID.get("helpful")}
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
        />
        <span className="pie-discussion__action-label">Helpful</span>
        <span className="pie-discussion__action-count" aria-hidden="true">
          {comment.likes}
        </span>
      </button>
      <button
        type="button"
        className={`pie-discussion__action${
          currentReaction === "dislike" ? " pie-discussion__action--active" : ""
        }`}
        aria-pressed={currentReaction === "dislike"}
        aria-label={`Not helpful. ${comment.dislikes} votes.`}
        disabled={reactionBusy}
        onClick={() => void handleReaction(currentReaction === "dislike" ? "none" : "dislike")}
      >
        <img
          className="pie-discussion__action-icon"
          src={ICON_BY_ACTION_ID.get("not-helpful")}
          alt=""
          aria-hidden="true"
          width={18}
          height={18}
        />
        <span className="pie-discussion__action-label">Not Helpful</span>
        <span className="pie-discussion__action-count" aria-hidden="true">
          {comment.dislikes}
        </span>
      </button>
      {showProposal ? (
        <button
          type="button"
          className={`pie-discussion__action${
            proposalState.disabled && collabAction !== "proposal"
              ? " pie-discussion__action--completed"
              : ""
          }`}
          disabled={proposalState.disabled}
          onClick={() =>
            void runCollaborationAction("proposal", () =>
              markCommentAsProposalCandidate(initiativeId, comment.commentId),
            )
          }
        >
          <img
            className="pie-discussion__action-icon"
            src={ICON_BY_ACTION_ID.get("proposal")}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
          />
          <span className="pie-discussion__action-label">{proposalState.label}</span>
        </button>
      ) : null}
      {showReady ? (
        <button
          type="button"
          className={`pie-discussion__action${
            readyState.disabled && collabAction !== "collaborate"
              ? " pie-discussion__action--completed"
              : ""
          }`}
          disabled={readyState.disabled}
          onClick={() =>
            void runCollaborationAction("collaborate", () =>
              expressInitiativeCollaborationInterest(initiativeId),
            )
          }
        >
          <img
            className="pie-discussion__action-icon"
            src={ICON_BY_ACTION_ID.get("ready-to-collaborate")}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
          />
          <span className="pie-discussion__action-label">{readyState.label}</span>
        </button>
      ) : null}
      {showInvitationResponse ? (
        <>
          <button
            type="button"
            className="pie-discussion__action"
            disabled={invitationResponseState.disabled}
            onClick={() =>
              void runCollaborationAction("accept-invitation", () =>
                respondToAlliesInvitation(initiativeId, "accept"),
              )
            }
          >
            <img
              className="pie-discussion__action-icon"
              src={ICON_BY_ACTION_ID.get("ready-to-collaborate")}
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
            />
            <span className="pie-discussion__action-label">
              {collabAction === "accept-invitation" ? "Accepting…" : "Accept Invitation"}
            </span>
          </button>
          <button
            type="button"
            className="pie-discussion__action"
            disabled={invitationResponseState.disabled}
            onClick={() =>
              void runCollaborationAction("decline-invitation", () =>
                respondToAlliesInvitation(initiativeId, "decline"),
              )
            }
          >
            <span className="pie-discussion__action-label">
              {collabAction === "decline-invitation" ? "Declining…" : "Decline"}
            </span>
          </button>
        </>
      ) : null}
      {showInvite ? (
        <button
          type="button"
          className={`pie-discussion__action${
            inviteState.disabled && collabAction !== "invite"
              ? " pie-discussion__action--completed"
              : ""
          }`}
          disabled={inviteState.disabled}
          onClick={() =>
            void runCollaborationAction("invite", () =>
              inviteCommentAuthorToAllies(initiativeId, comment.commentId),
            )
          }
        >
          <img
            className="pie-discussion__action-icon"
            src={ICON_BY_ACTION_ID.get("invite-to-allies")}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
          />
          <span className="pie-discussion__action-label">{inviteState.label}</span>
        </button>
      ) : null}

      {actionError ? <p className="pie-discussion__collab-error">{actionError}</p> : null}
    </div>
  );
}

/** Part 4/5 — one complete visual card: author row, comment, status indicators, action row. */
function DiscussionCommentCard({
  initiativeId,
  comment,
  authStatus,
  returnTo,
  isDeepLinkTarget,
  onReactionUpdated,
  onCollaborationChanged,
  showStandardParticipationActions = true,
}: {
  initiativeId: string;
  comment: PublicInitiativeDiscussionComment;
  authStatus: ReturnType<typeof useClientAuthStatus>;
  returnTo: string;
  isDeepLinkTarget?: boolean;
  onReactionUpdated: (comment: PublicInitiativeDiscussionComment) => void;
  onCollaborationChanged: () => void;
  showStandardParticipationActions?: boolean;
}) {
  const authorLink = resolveAuthorLinkPresentation(comment.author);
  const badges = resolveAuthorBadges(comment.collaboration);
  const indicators = resolveStatusIndicators(comment.collaboration);

  return (
    <li
      id={buildDiscussionCommentDomId(comment.commentId)}
      className={
        isDeepLinkTarget
          ? "pie-discussion__comment-card pie-discussion__comment-card--deep-link-target"
          : "pie-discussion__comment-card"
      }
    >
      <p className="pie-discussion__author">
        {comment.author.avatarUrl ? (
          <img
            className="pie-discussion__author-avatar"
            src={comment.author.avatarUrl}
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
          />
        ) : null}
        {authorLink.isLink ? (
          <a className="pie-discussion__author-link" href={authorLink.href}>
            <span className="pie-discussion__author-name">{comment.author.displayName}</span>
          </a>
        ) : (
          <span className="pie-discussion__author-name">{comment.author.displayName}</span>
        )}
        {badges.isInitiativeAuthor ? (
          <span className="pie-discussion__badge pie-discussion__badge--steward">
            Initiative Author
          </span>
        ) : null}
        {badges.isYou ? <span className="pie-discussion__badge pie-discussion__badge--you">You</span> : null}
        <span className="pie-discussion__date">{formatCommentDate(comment.createdAt)}</span>
      </p>
      <p className="pie-discussion__body">{comment.body}</p>
      {indicators.length > 0 ? (
        <p className="pie-discussion__collab-indicators">
          {indicators.map((indicator) => (
            <span key={indicator} className="pie-discussion__collab-indicator">
              {indicator}
            </span>
          ))}
        </p>
      ) : null}
      <CommentActions
        initiativeId={initiativeId}
        comment={comment}
        authStatus={authStatus}
        returnTo={returnTo}
        onReactionUpdated={onReactionUpdated}
        onCollaborationChanged={onCollaborationChanged}
        showStandardParticipationActions={showStandardParticipationActions}
      />
    </li>
  );
}

/**
 * Profile UX Pack 01 Parts 2/8 — the "Collaboration" filter's compact
 * Participant list: avatar, name, status, and (for the Initiative Author
 * only, on still-pending interest requests) Accept/Decline. Lifecycle
 * Staging Fix 02 — invited Participants see Accept invitation on their own
 * `invitation_pending` row via the same `respondToAlliesInvitation` API as
 * the comment-level control. Deliberately does not reuse
 * `DiscussionCommentCard`. Sourced from the Ally store via
 * `fetchInitiativeCollaborationParticipants`.
 */
function CollaborationParticipantList({
  initiativeId,
  participants,
  isViewerInitiativeSteward,
  viewerParticipantId,
  onChanged,
}: {
  initiativeId: string;
  participants: readonly PublicInitiativeCollaborationParticipant[];
  isViewerInitiativeSteward: boolean;
  viewerParticipantId: string | null;
  onChanged: () => void;
}) {
  const [busyParticipantId, setBusyParticipantId] = useState<string | null>(null);
  const [busyOwnInvitation, setBusyOwnInvitation] = useState(false);
  const [errorByParticipantId, setErrorByParticipantId] = useState<Record<string, string>>({});
  const [ownInvitationError, setOwnInvitationError] = useState<string | null>(null);

  async function handleRespond(participantId: string, response: "accept" | "decline"): Promise<void> {
    setBusyParticipantId(participantId);
    setErrorByParticipantId((current) => {
      if (!(participantId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[participantId];
      return next;
    });

    try {
      await respondToInitiativeCollaborationInterest(initiativeId, participantId, response);
      onChanged();
    } catch (error) {
      setErrorByParticipantId((current) => ({
        ...current,
        [participantId]:
          error instanceof Error ? error.message : "This request could not be updated.",
      }));
    } finally {
      setBusyParticipantId(null);
    }
  }

  async function handleAcceptOwnInvitation(): Promise<void> {
    setBusyOwnInvitation(true);
    setOwnInvitationError(null);

    try {
      await respondToAlliesInvitation(initiativeId, "accept");
      onChanged();
    } catch (error) {
      setOwnInvitationError(
        error instanceof Error ? error.message : "This invitation could not be accepted.",
      );
    } finally {
      setBusyOwnInvitation(false);
    }
  }

  return (
    <ul className="pie-collab-list" id={COLLABORATION_LIST_DOM_ID}>
      {participants.map((entry) => {
        const authorLink = resolveAuthorLinkPresentation(entry.author);
        const name = entry.author.displayName;
        const isOwnRow = Boolean(
          viewerParticipantId && entry.participantId === viewerParticipantId,
        );
        const invitationAcceptState = resolveCollaborationInvitationAcceptState({
          status: entry.status,
          isOwnRow,
          isViewerInitiativeSteward,
          busy: busyOwnInvitation,
        });
        const statusLabel = invitationAcceptState.visible
          ? null
          : resolveCollaborationStatusLabel(entry.status);
        const reviewState = resolveCollaborationReviewActionState(
          entry.status,
          isViewerInitiativeSteward,
          busyParticipantId === entry.participantId,
        );
        const entryError = errorByParticipantId[entry.participantId];

        return (
          <li
            key={entry.participantId}
            id={buildCollaborationParticipantDomId(entry.participantId)}
            className="pie-collab-list__item"
            data-participant-id={entry.participantId}
            data-own-invitation-pending={invitationAcceptState.visible ? "true" : undefined}
          >
            <span className="pie-collab-list__identity">
              {entry.author.avatarUrl ? (
                <img
                  className="pie-collab-list__avatar"
                  src={entry.author.avatarUrl}
                  alt=""
                  aria-hidden="true"
                  width={32}
                  height={32}
                />
              ) : (
                <span
                  className="pie-collab-list__avatar pie-collab-list__avatar--placeholder"
                  aria-hidden="true"
                />
              )}
              {authorLink.isLink ? (
                <a className="pie-collab-list__name pie-discussion__author-link" href={authorLink.href}>
                  {name}
                </a>
              ) : (
                <span className="pie-collab-list__name">{name}</span>
              )}
              {statusLabel ? (
                <span className="pie-collab-list__status">{statusLabel}</span>
              ) : null}
              {invitationAcceptState.visible ? (
                <button
                  type="button"
                  className="hu-button hu-button--primary pie-collab-list__review-button"
                  disabled={invitationAcceptState.disabled}
                  onClick={() => void handleAcceptOwnInvitation()}
                >
                  {busyOwnInvitation ? "Accepting…" : "Accept invitation"}
                </button>
              ) : null}
            </span>
            {reviewState.visible ? (
              <span className="pie-collab-list__review-actions">
                <button
                  type="button"
                  className="hu-button hu-button--primary pie-collab-list__review-button"
                  disabled={reviewState.disabled}
                  onClick={() => void handleRespond(entry.participantId, "accept")}
                >
                  {busyParticipantId === entry.participantId ? "Working…" : "Accept"}
                </button>
                <button
                  type="button"
                  className="hu-button hu-button--secondary pie-collab-list__review-button"
                  disabled={reviewState.disabled}
                  onClick={() => void handleRespond(entry.participantId, "decline")}
                >
                  Decline
                </button>
              </span>
            ) : null}
            {entryError ? <p className="pie-collab-list__error">{entryError}</p> : null}
            {invitationAcceptState.visible && ownInvitationError ? (
              <p className="pie-collab-list__error">{ownInvitationError}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function PublicDiscussionPanel({
  initiativeId,
  initialComments = [],
  commentCount = 0,
  hasMoreComments = false,
  panelId,
  scopeLabel,
  initialFilter,
  focusCommentId,
  focusCollaborationParticipantId,
  lifecycleProfile,
}: PublicDiscussionPanelProps) {
  const presentation = getInitiativeLifecycleProfilePresentation(lifecycleProfile);
  const authStatus = useClientAuthStatus();
  const [comments, setComments] = useState(initialComments);
  const [totalCount, setTotalCount] = useState(commentCount);
  const [hasMore, setHasMore] = useState(hasMoreComments);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<{
    variant: "warning" | "error" | "success";
    message: string;
  } | null>(null);
  const [restrictedMessage, setRestrictedMessage] = useState<string | null>(null);
  const [canComment, setCanComment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<DiscussionFilter>(initialFilter ?? "all");
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [collaborationData, setCollaborationData] =
    useState<PublicInitiativeCollaborationParticipantsResult | null>(null);
  const [collaborationLoading, setCollaborationLoading] = useState(false);
  const experienceRefresh = useInitiativeExperienceRefresh();
  const returnTo = buildDiscussionReturnTo(initiativeId);
  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}${initiativeId}`;
  const deepLinkScrollCompletedFor = useRef<string | null>(null);
  const collaborationDeepLinkScrolled = useRef(false);

  useEffect(() => {
    setComments(initialComments);
    setTotalCount(commentCount);
    setHasMore(hasMoreComments);
  }, [initialComments, commentCount, hasMoreComments]);

  useEffect(() => {
    // `initialFilter` is resolved from the URL by the parent page one tick after
    // mount, so it may transition from undefined to "collaboration" — pick that up.
    if (initialFilter) {
      setFilter(initialFilter);
    }
  }, [initialFilter]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedDraft = window.sessionStorage.getItem(draftStorageKey);

    if (savedDraft) {
      setDraft(savedDraft);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setCanComment(false);
      setRestrictedMessage(null);
      return;
    }

    let cancelled = false;

    void getMe()
      .then((user) => {
        if (cancelled) {
          return;
        }

        if (user.status !== "active") {
          setCanComment(false);
          setRestrictedMessage("Your account is restricted and cannot post comments.");
          return;
        }

        if (user.emailVerificationStatus !== "verified") {
          setCanComment(false);
          setRestrictedMessage("Confirm your email address before posting comments.");
          return;
        }

        setCanComment(true);
        setRestrictedMessage(null);
      })
      .catch(() => {
        if (!cancelled) {
          setCanComment(false);
          setRestrictedMessage("Unable to verify your account for commenting.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    setFeedback(null);

    try {
      const response = await fetchInitiativeComments(initiativeId, comments.length, 40);
      setComments((current) => [...current, ...response.comments]);
      setTotalCount(response.total);
      setHasMore(response.hasMore);
    } catch {
      setFeedback({
        variant: "warning",
        message: "Unable to load more comments. Please try again.",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  /**
   * Profile UX Pack 01 Part 2/8 — the Collaboration working list is sourced
   * directly from the Ally store (not derived from loaded comments), so it
   * correctly includes every Participant who expressed interest, even one
   * who never posted a comment themselves. Loaded lazily when the filter is
   * selected, and reloaded after every Accept/Decline.
   */
  const loadCollaborationParticipants = useCallback(async (): Promise<void> => {
    setCollaborationLoading(true);

    try {
      const result = await fetchInitiativeCollaborationParticipants(initiativeId);
      setCollaborationData(result);
    } catch {
      // Keep any previously loaded list; the tab remains usable.
    } finally {
      setCollaborationLoading(false);
    }
  }, [initiativeId]);

  /**
   * A single collaboration action (Proposal / Ready to Collaborate / Invite
   * to Allies) can change the collaboration state of every comment by the
   * same author, not just the one that was clicked. Re-fetching the
   * currently loaded page is simpler and more correct than optimistic
   * per-comment patching, and the list is bounded (default 40).
   */
  const handleCollaborationChanged = async (): Promise<void> => {
    try {
      const response = await fetchInitiativeComments(initiativeId, 0, Math.max(comments.length, 40));
      setComments(response.comments);
      setTotalCount(response.total);
      setHasMore(response.hasMore);
      if (filter === "collaboration") {
        void loadCollaborationParticipants();
      }
      await experienceRefresh?.refresh();
    } catch {
      // Keep the existing list; the action itself already succeeded.
    }
  };

  const handleCollaborationListChanged = useCallback(async (): Promise<void> => {
    await loadCollaborationParticipants();
    await experienceRefresh?.refresh();
  }, [loadCollaborationParticipants, experienceRefresh]);

  const filteredComments = useMemo(
    () => comments.filter((comment) => matchesDiscussionFilter(comment, filter)),
    [comments, filter],
  );
  const filterHeading = resolveFilterHeading(filter);
  const focusedRenderedCommentId = resolveDiscussionCommentFocusTarget(
    filteredComments.map((comment) => comment.commentId),
    focusCommentId,
  );

  useEffect(() => {
    deepLinkScrollCompletedFor.current = null;
  }, [focusCommentId]);

  useEffect(() => {
    const plan = planDiscussionCommentDeepLinkScroll({
      focusCommentId,
      filter,
      renderedCommentIds: filteredComments.map((comment) => comment.commentId),
      hasMore,
      loadingMore,
      alreadyScrolledFor: deepLinkScrollCompletedFor.current,
    });

    if (plan.action === "reset_filter_all") {
      setFilter("all");
      return;
    }

    if (plan.action === "load_more") {
      void handleLoadMore();
      return;
    }

    if (plan.action !== "scroll") {
      return;
    }

    const scrolled = applyDiscussionCommentDeepLinkScroll(plan.domId);
    if (!scrolled) {
      return;
    }

    setHighlightedCommentId(plan.commentId);
    deepLinkScrollCompletedFor.current = plan.commentId;

    const element = document.getElementById(plan.domId);
    const clearHighlight = () => {
      setHighlightedCommentId((current) => (current === plan.commentId ? null : current));
    };
    element?.addEventListener("animationend", clearHighlight, { once: true });
    return () => element?.removeEventListener("animationend", clearHighlight);
  }, [focusCommentId, filter, filteredComments, hasMore, loadingMore]);

  useEffect(() => {
    if (filter === "collaboration") {
      void loadCollaborationParticipants();
    }
  }, [filter, loadCollaborationParticipants]);

  /**
   * Lifecycle Staging Fix 02 / 05B / 05C / 05D — collaboration notification deep-link.
   * With `focusCollaborationParticipantId`: scroll that Ally row once it exists.
   * Without: generic title + list (05C). Desktop uses center pane only.
   */
  useEffect(() => {
    if (filter !== "collaboration" || collaborationLoading) {
      return;
    }

    if (collaborationDeepLinkScrolled.current) {
      return;
    }

    if (!collaborationData) {
      return;
    }

    const participantId = focusCollaborationParticipantId?.trim() || null;
    if (participantId) {
      const present = collaborationData.participants.some(
        (entry) => entry.participantId === participantId,
      );
      if (!present) {
        return;
      }
    }

    const applied = applyCollaborationNotificationScroll({
      participantId,
    });
    if (!applied) {
      return;
    }
    collaborationDeepLinkScrolled.current = true;
  }, [
    filter,
    collaborationLoading,
    collaborationData,
    focusCollaborationParticipantId,
  ]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!draft.trim()) {
      setFeedback({ variant: "warning", message: "Enter a comment before submitting." });
      return;
    }

    setSubmitting(true);

    try {
      const created = await postInitiativeComment(initiativeId, draft.trim());
      setComments((current) => [created, ...current]);
      setTotalCount((current) => current + 1);
      setDraft("");
      window.sessionStorage.removeItem(draftStorageKey);
      setFeedback({ variant: "success", message: "Your comment was posted." });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Your comment could not be saved. Please try again.";
      const variant = message.toLowerCase().includes("wait") ? "warning" : "error";
      setFeedback({ variant, message });
    } finally {
      setSubmitting(false);
    }
  };

  const sectionProps = panelId ? { id: panelId } : {};
  const titleId = panelId ? `${panelId}-title` : "pie-discussion-title";

  if (authStatus === "pending") {
    return (
      <section {...sectionProps} className="pie-discussion" aria-labelledby={titleId}>
        <h2 id={titleId} className="pie-discussion__title">
          Discussion
        </h2>
        {scopeLabel ? <p className="pie-discussion__scope">{scopeLabel}</p> : null}
        <p className="pie-empty">Loading discussion access…</p>
      </section>
    );
  }

  return (
    <section {...sectionProps} className="pie-discussion" aria-labelledby={titleId}>
      <h2 id={titleId} className="pie-discussion__title">
        Discussion
      </h2>
      {scopeLabel ? <p className="pie-discussion__scope">{scopeLabel}</p> : null}

      {/*
       * UX Evolution Pack 02.3 Part 3 / 02.4 Part 8 — compact guidance,
       * always rendered (including for guests) regardless of whether
       * comments exist yet or the viewer is signed in. Intentionally a
       * single short paragraph, not an instruction panel.
       */}
      <p className="pie-discussion__guidance">
        {presentation.discussionShowsStandardParticipationActions ? (
          <>
            Comments help improve this Initiative. Select <strong>Proposal</strong> to add a comment
            to the improvement ideas list. Select <strong>Ready to Collaborate</strong> to let the
            Initiative Author know that you want to help. The Initiative Author can then select{" "}
            <strong>Invite to Allies</strong> to invite that Participant into the Initiative team.
          </>
        ) : (
          <>
            Share comments about this Public Choice. Use the vote control below to Support, Do not
            support, or Abstain. Comments require a signed-in Participant.
          </>
        )}
      </p>

      {presentation.discussionShowsVoteBallot ? (
        <PublicChoiceDiscussionVotePanel initiativeId={initiativeId} />
      ) : null}

      {/*
       * Profile UX Pack 01 Part 8 — the Collaboration filter/tab must remain
       * reachable (and its working list visible) even when the Initiative
       * has zero Discussion comments, since it is sourced from the Ally
       * store rather than from comments.
       */}
      {presentation.discussionShowsStandardParticipationActions &&
      (comments.length > 0 || filter === "collaboration") ? (
        <div className="pie-discussion__filters" role="group" aria-label="Filter comments">
          {DISCUSSION_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`pie-discussion__filter${
                filter === option.id ? " pie-discussion__filter--active" : ""
              }`}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {comments.length > 0 || filter === "collaboration" ? (
        filterHeading ? (
          <p className="pie-discussion__filter-heading">{filterHeading}</p>
        ) : (
          <div className="pie-discussion__feedback-heading">
            <h3 className="pie-discussion__feedback-title">Comment Feedback</h3>
            <p className="pie-discussion__feedback-note">Express your opinion about this comment.</p>
          </div>
        )
      ) : null}

      {comments.length > 0 || filter === "collaboration" ? (
        filter === "collaboration" ? (
          collaborationLoading && !collaborationData ? (
            <p className="pie-empty" id={COLLABORATION_LIST_DOM_ID}>
              Loading collaboration requests…
            </p>
          ) : collaborationData && collaborationData.participants.length > 0 ? (
            <CollaborationParticipantList
              initiativeId={initiativeId}
              participants={collaborationData.participants}
              isViewerInitiativeSteward={collaborationData.isViewerInitiativeSteward}
              viewerParticipantId={collaborationData.viewerParticipantId}
              onChanged={() => void handleCollaborationListChanged()}
            />
          ) : (
            <p className="pie-empty" id={COLLABORATION_LIST_DOM_ID}>
              No participants have expressed interest yet.
            </p>
          )
        ) : filteredComments.length > 0 ? (
          <div className="pie-discussion__comments-wrap">
            <ul className="pie-discussion__comments">
              {filteredComments.map((comment) => (
                <DiscussionCommentCard
                  key={comment.commentId}
                  initiativeId={initiativeId}
                  comment={comment}
                  authStatus={authStatus}
                  returnTo={returnTo}
                  isDeepLinkTarget={
                    highlightedCommentId === comment.commentId ||
                    focusedRenderedCommentId === comment.commentId
                  }
                  showStandardParticipationActions={
                    presentation.discussionShowsStandardParticipationActions
                  }
                  onReactionUpdated={(updated) => {
                    setComments((current) =>
                      current.map((entry) =>
                        entry.commentId === updated.commentId
                          ? { ...updated, collaboration: entry.collaboration }
                          : entry,
                      ),
                    );
                  }}
                  onCollaborationChanged={() => void handleCollaborationChanged()}
                />
              ))}
            </ul>
          </div>
        ) : (
          <p className="pie-empty">No comments match this filter.</p>
        )
      ) : (
        <p className="pie-empty">
          {totalCount > 0
            ? `${totalCount} comment${totalCount === 1 ? "" : "s"}`
            : "No comments have been added."}
        </p>
      )}

      {hasMore ? (
        <button
          type="button"
          className="hu-button hu-button--secondary pie-discussion__load-more"
          disabled={loadingMore}
          onClick={() => void handleLoadMore()}
        >
          {loadingMore ? "Loading…" : "Load more comments"}
        </button>
      ) : null}

      {authStatus === "unauthenticated" ? (
        <div className="pie-discussion__guest">
          <p>Sign in to join the discussion.</p>
          <div className="pie-discussion__guest-actions">
            <Button href={`/login?returnTo=${encodeURIComponent(returnTo)}`} variant="primary">
              Log In
            </Button>
            <Button href={`/register?returnTo=${encodeURIComponent(returnTo)}`} variant="secondary">
              Create Account
            </Button>
          </div>
        </div>
      ) : null}

      {restrictedMessage ? (
        <HuFeedbackMessage variant="warning" title="Commenting unavailable">
          {restrictedMessage}
        </HuFeedbackMessage>
      ) : null}

      {canComment ? (
        <form className="pie-discussion__form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor={panelId ? `${panelId}-comment` : "pie-discussion-comment"}>
            Add a comment
          </label>
          <textarea
            id={panelId ? `${panelId}-comment` : "pie-discussion-comment"}
            className="pie-discussion__input"
            rows={4}
            value={draft}
            disabled={submitting}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              window.sessionStorage.setItem(draftStorageKey, value);
            }}
          />
          <button type="submit" className="hu-button hu-button--primary" disabled={submitting}>
            {submitting ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : null}

      {feedback ? (
        <HuFeedbackMessage variant={feedback.variant}>{feedback.message}</HuFeedbackMessage>
      ) : null}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

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
import { formatInitiativeExperienceDate } from "../initiative-experience-i18n";
import { useInitiativeExperienceRefresh } from "../initiative-experience-refresh-context";
import {
  DISCUSSION_ACTION_DEFINITIONS,
  DISCUSSION_FILTER_IDS,
  matchesDiscussionFilter,
  resolveAlliesInvitationResponseState,
  resolveAuthorBadges,
  resolveAuthorLinkPresentation,
  resolveCollaborationInvitationAcceptState,
  resolveCollaborationReviewActionState,
  resolveCollaborationStatusLabelKey,
  resolveFilterHeadingKey,
  resolveInviteToAlliesActionState,
  resolveProposalActionState,
  resolveReadyToCollaborateActionState,
  resolveStatusIndicatorKeys,
  type DiscussionChromeLabelKey,
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

const FILTER_LABEL_KEYS: Record<DiscussionFilter, string> = {
  all: "collaboration.discussion.filtersAll",
  proposals: "collaboration.discussion.filtersProposals",
  collaboration: "collaboration.discussion.filtersCollaboration",
};

function buildDiscussionReturnTo(initiativeId: string): string {
  return resolveSafeReturnTo(
    `/initiatives/public/${encodeURIComponent(initiativeId)}#discussion`,
    "/",
  );
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

function chromeLabel(
  t: (key: `collaboration.discussion.chrome.${DiscussionChromeLabelKey}`) => string,
  key: DiscussionChromeLabelKey,
): string {
  return t(`collaboration.discussion.chrome.${key}`);
}

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
  const t = useTranslations("initiativeExperience");
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
        error instanceof Error ? error.message : t("collaboration.discussion.actionFailed"),
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
          aria-label={t("collaboration.discussion.helpfulAriaGuest", { count: comment.likes })}
        >
          <img
            className="pie-discussion__action-icon"
            src={ICON_BY_ACTION_ID.get("helpful")}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
          />
          <span className="pie-discussion__action-label">
            {chromeLabel(t, "helpful")}
          </span>
          <span className="pie-discussion__action-count" aria-hidden="true">
            {comment.likes}
          </span>
        </a>
        <a
          className="pie-discussion__action pie-discussion__action--guest"
          href={loginHref}
          aria-label={t("collaboration.discussion.notHelpfulAriaGuest", {
            count: comment.dislikes,
          })}
        >
          <img
            className="pie-discussion__action-icon"
            src={ICON_BY_ACTION_ID.get("not-helpful")}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
          />
          <span className="pie-discussion__action-label">
            {chromeLabel(t, "notHelpful")}
          </span>
          <span className="pie-discussion__action-count" aria-hidden="true">
            {comment.dislikes}
          </span>
        </a>
        <a className="pie-discussion__action-link" href={registerHref}>
          {t("collaboration.discussion.createAccount")}
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
    <div
      className="pie-discussion__actions"
      role="group"
      aria-label={t("collaboration.discussion.feedbackActionsAria")}
    >
      <button
        type="button"
        className={`pie-discussion__action${
          currentReaction === "like" ? " pie-discussion__action--active" : ""
        }`}
        aria-pressed={currentReaction === "like"}
        aria-label={t("collaboration.discussion.helpfulAria", { count: comment.likes })}
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
        <span className="pie-discussion__action-label">{chromeLabel(t, "helpful")}</span>
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
        aria-label={t("collaboration.discussion.notHelpfulAria", { count: comment.dislikes })}
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
        <span className="pie-discussion__action-label">{chromeLabel(t, "notHelpful")}</span>
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
          <span className="pie-discussion__action-label">
            {chromeLabel(t, proposalState.labelKey)}
          </span>
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
          <span className="pie-discussion__action-label">
            {chromeLabel(t, readyState.labelKey)}
          </span>
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
              {collabAction === "accept-invitation"
                ? t("collaboration.discussion.accepting")
                : t("collaboration.discussion.acceptInvitation")}
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
              {collabAction === "decline-invitation"
                ? t("collaboration.discussion.declining")
                : t("collaboration.discussion.decline")}
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
          <span className="pie-discussion__action-label">
            {chromeLabel(t, inviteState.labelKey)}
          </span>
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
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const authorLink = resolveAuthorLinkPresentation(comment.author);
  const badges = resolveAuthorBadges(comment.collaboration);
  const indicatorKeys = resolveStatusIndicatorKeys(comment.collaboration);

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
            {t("collaboration.discussion.authorBadge")}
          </span>
        ) : null}
        {badges.isYou ? (
          <span className="pie-discussion__badge pie-discussion__badge--you">
            {t("collaboration.discussion.youBadge")}
          </span>
        ) : null}
        <span className="pie-discussion__date">
          {formatInitiativeExperienceDate(locale, comment.createdAt, { month: "short" })}
        </span>
      </p>
      <p className="pie-discussion__body">{comment.body}</p>
      {indicatorKeys.length > 0 ? (
        <p className="pie-discussion__collab-indicators">
          {indicatorKeys.map((key) => (
            <span key={key} className="pie-discussion__collab-indicator">
              {chromeLabel(t, key)}
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
  const t = useTranslations("initiativeExperience");
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
          error instanceof Error
            ? error.message
            : t("collaboration.discussion.requestUpdateFailed"),
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
        error instanceof Error
          ? error.message
          : t("collaboration.discussion.invitationAcceptFailed"),
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
        const statusLabelKey = invitationAcceptState.visible
          ? null
          : resolveCollaborationStatusLabelKey(entry.status);
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
              {statusLabelKey ? (
                <span className="pie-collab-list__status">{chromeLabel(t, statusLabelKey)}</span>
              ) : null}
              {invitationAcceptState.visible ? (
                <button
                  type="button"
                  className="hu-button hu-button--primary pie-collab-list__review-button"
                  disabled={invitationAcceptState.disabled}
                  onClick={() => void handleAcceptOwnInvitation()}
                >
                  {busyOwnInvitation
                    ? t("collaboration.discussion.accepting")
                    : t("collaboration.discussion.acceptInvitation")}
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
                  {busyParticipantId === entry.participantId
                    ? t("collaboration.discussion.working")
                    : t("collaboration.discussion.accept")}
                </button>
                <button
                  type="button"
                  className="hu-button hu-button--secondary pie-collab-list__review-button"
                  disabled={reviewState.disabled}
                  onClick={() => void handleRespond(entry.participantId, "decline")}
                >
                  {t("collaboration.discussion.decline")}
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
  const t = useTranslations("initiativeExperience");
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
          setRestrictedMessage(t("collaboration.discussion.restrictedAccount"));
          return;
        }

        if (user.emailVerificationStatus !== "verified") {
          setCanComment(false);
          setRestrictedMessage(t("collaboration.discussion.confirmEmail"));
          return;
        }

        setCanComment(true);
        setRestrictedMessage(null);
      })
      .catch(() => {
        if (!cancelled) {
          setCanComment(false);
          setRestrictedMessage(t("collaboration.discussion.unableVerify"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, t]);

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
        message: t("collaboration.discussion.loadMoreFailed"),
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
  const filterHeadingKey = resolveFilterHeadingKey(filter);
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
      setFeedback({ variant: "warning", message: t("collaboration.discussion.enterComment") });
      return;
    }

    setSubmitting(true);

    try {
      const created = await postInitiativeComment(initiativeId, draft.trim());
      setComments((current) => [created, ...current]);
      setTotalCount((current) => current + 1);
      setDraft("");
      window.sessionStorage.removeItem(draftStorageKey);
      setFeedback({ variant: "success", message: t("collaboration.discussion.commentPosted") });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("collaboration.discussion.commentSaveFailed");
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
          {t("collaboration.discussion.title")}
        </h2>
        {scopeLabel ? <p className="pie-discussion__scope">{scopeLabel}</p> : null}
        <p className="pie-empty">{t("collaboration.discussion.loadingAccess")}</p>
      </section>
    );
  }

  return (
    <section {...sectionProps} className="pie-discussion" aria-labelledby={titleId}>
      <h2 id={titleId} className="pie-discussion__title">
        {t("collaboration.discussion.title")}
      </h2>
      {scopeLabel ? <p className="pie-discussion__scope">{scopeLabel}</p> : null}

      {/*
       * UX Evolution Pack 02.3 Part 3 / 02.4 Part 8 — compact guidance,
       * always rendered (including for guests) regardless of whether
       * comments exist yet or the viewer is signed in. Intentionally a
       * single short paragraph, not an instruction panel.
       */}
      <p className="pie-discussion__guidance">
        {presentation.discussionShowsStandardParticipationActions
          ? t("collaboration.discussion.guidanceStandard")
          : t("collaboration.discussion.guidancePublicChoice")}
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
        <div
          className="pie-discussion__filters"
          role="group"
          aria-label={t("collaboration.discussion.filterAria")}
        >
          {DISCUSSION_FILTER_IDS.map((filterId) => (
            <button
              key={filterId}
              type="button"
              className={`pie-discussion__filter${
                filter === filterId ? " pie-discussion__filter--active" : ""
              }`}
              aria-pressed={filter === filterId}
              onClick={() => setFilter(filterId)}
            >
              {t(FILTER_LABEL_KEYS[filterId])}
            </button>
          ))}
        </div>
      ) : null}

      {comments.length > 0 || filter === "collaboration" ? (
        filterHeadingKey ? (
          <p className="pie-discussion__filter-heading">
            {chromeLabel(t, filterHeadingKey)}
          </p>
        ) : (
          <div className="pie-discussion__feedback-heading">
            <h3 className="pie-discussion__feedback-title">
              {t("collaboration.discussion.commentFeedback")}
            </h3>
            <p className="pie-discussion__feedback-note">
              {t("collaboration.discussion.commentFeedbackNote")}
            </p>
          </div>
        )
      ) : null}

      {comments.length > 0 || filter === "collaboration" ? (
        filter === "collaboration" ? (
          collaborationLoading && !collaborationData ? (
            <p className="pie-empty" id={COLLABORATION_LIST_DOM_ID}>
              {t("collaboration.discussion.loadingCollaboration")}
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
              {t("collaboration.discussion.emptyInterest")}
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
          <p className="pie-empty">{t("collaboration.discussion.emptyFilter")}</p>
        )
      ) : (
        <p className="pie-empty">
          {totalCount > 0
            ? t("collaboration.discussion.commentsCount", { count: totalCount })
            : t("collaboration.discussion.emptyComments")}
        </p>
      )}

      {hasMore ? (
        <button
          type="button"
          className="hu-button hu-button--secondary pie-discussion__load-more"
          disabled={loadingMore}
          onClick={() => void handleLoadMore()}
        >
          {loadingMore
            ? t("collaboration.discussion.loading")
            : t("collaboration.discussion.loadMore")}
        </button>
      ) : null}

      {authStatus === "unauthenticated" ? (
        <div className="pie-discussion__guest">
          <p>{t("collaboration.discussion.signIn")}</p>
          <div className="pie-discussion__guest-actions">
            <Button href={`/login?returnTo=${encodeURIComponent(returnTo)}`} variant="primary">
              {t("collaboration.discussion.logIn")}
            </Button>
            <Button href={`/register?returnTo=${encodeURIComponent(returnTo)}`} variant="secondary">
              {t("collaboration.discussion.createAccount")}
            </Button>
          </div>
        </div>
      ) : null}

      {restrictedMessage ? (
        <HuFeedbackMessage
          variant="warning"
          title={t("collaboration.discussion.commentingUnavailable")}
        >
          {restrictedMessage}
        </HuFeedbackMessage>
      ) : null}

      {canComment ? (
        <form className="pie-discussion__form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor={panelId ? `${panelId}-comment` : "pie-discussion-comment"}>
            {t("collaboration.discussion.addComment")}
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
            {submitting
              ? t("collaboration.discussion.posting")
              : t("collaboration.discussion.postComment")}
          </button>
        </form>
      ) : null}

      {feedback ? (
        <HuFeedbackMessage variant={feedback.variant}>{feedback.message}</HuFeedbackMessage>
      ) : null}
    </section>
  );
}

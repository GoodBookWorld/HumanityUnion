"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";

import "./communication-card.css";

export type CommunicationCardMode = "notification" | "message" | "reminder";

const MODE_ICON: Record<CommunicationCardMode, string> = {
  notification: "/icons/workspace/icons8-notification.svg",
  message: "/icons/workspace/message.svg",
  reminder: "/icons/workspace/progress.svg",
};

export interface CommunicationCardProps {
  mode: CommunicationCardMode;
  /** Present for Message-mode rows (sender avatar); notification/reminder rows use a mode icon instead. */
  avatarUrl?: string | null;
  title: string;
  description?: string;
  /** Formatted relative/absolute timestamp — never a raw ISO string. */
  meta?: string;
  /** Notification-mode priority badge (Part 6 — presentation-only, the priority value itself is unchanged). */
  badge?: ReactNode;
  unread?: boolean;
  /** Accessible name for the unread marker, e.g. "Unread message from Ada Lovelace". */
  unreadLabel?: string;
  /**
   * When set and no `actions` are given, the whole card is a single link
   * (Message/Reminder rows — Part 3/5: one action, one destination, no
   * intermediate screen). Notification rows instead pass `actions` for
   * their existing multi-control footer (View record / Mark read / Archive,
   * Part 6 — unchanged) and are never made into a single anchor.
   */
  href?: string;
  ariaLabel?: string;
  /** Notification-mode-only action row (Mark read / Archive / View record). */
  actions?: ReactNode;
  /**
   * Lifecycle UX Correction Pack 01 Part 6 — fired alongside navigation on
   * a link-mode card (e.g. a Reminder marking itself completed as the
   * Participant follows it into the recommended workspace). Never blocks
   * or delays the navigation itself.
   */
  onClick?: () => void;
}

/**
 * Communication UX Pack 03.4 Part 3 — the one reusable row shared by all
 * three Notification Center sections. Only styling differs per `mode`
 * (`communication-card--notification` / `--message` / `--reminder`); the
 * interaction model is identical across modes: a leading avatar/icon, a
 * title, an optional description/preview, a meta timestamp, and an unread
 * marker that is never color-only (Part 10) — always paired with
 * visually-hidden text.
 */
export function CommunicationCard({
  mode,
  avatarUrl,
  title,
  description,
  meta,
  badge,
  unread = false,
  unreadLabel,
  href,
  ariaLabel,
  actions,
  onClick,
}: CommunicationCardProps) {
  const leading =
    mode === "message" ? (
      <HumanityAvatar className="communication-card__avatar" avatarUrl={avatarUrl} size={40} alt="" />
    ) : (
      <span className="communication-card__icon" aria-hidden="true">
        <Image src={MODE_ICON[mode]} alt="" width={20} height={20} />
      </span>
    );

  const body = (
    <>
      {leading}
      <span className="communication-card__body">
        <span className="communication-card__header-row">
          <span className="communication-card__title">{title}</span>
          {badge}
        </span>
        {description ? <span className="communication-card__description">{description}</span> : null}
        {meta ? <span className="communication-card__meta">{meta}</span> : null}
      </span>
      {unread ? (
        <>
          <span className="communication-card__unread-dot" aria-hidden="true" />
          <span className="communication-card__visually-hidden">{unreadLabel ?? "Unread"}</span>
        </>
      ) : null}
    </>
  );

  const className = `communication-card communication-card--${mode}${unread ? " communication-card--unread" : ""}`;

  if (href && !actions) {
    return (
      <li className="communication-card__item">
        <Link href={href} className={className} aria-label={ariaLabel} onClick={onClick}>
          {body}
        </Link>
      </li>
    );
  }

  return (
    <li className={`${className} communication-card--panel`}>
      {body}
      {actions ? <div className="communication-card__actions">{actions}</div> : null}
    </li>
  );
}

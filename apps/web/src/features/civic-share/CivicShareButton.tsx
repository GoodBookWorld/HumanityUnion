"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import type { CivicSharePayload } from "./civic-share.types";
import { isCivicSharePayloadPublic } from "./civic-share.types";
import {
  canUseWebShareApi,
  buildWebShareData,
  resolveAbsoluteCivicShareUrl,
} from "./civic-share.urls";
import { shareCivicChannel, shareCivicViaNative, type CivicShareChannel } from "./civic-share.actions";
import { shouldOfferNativeShareShortcut } from "./civic-share-native-policy";

import "./civic-share.css";

export { shouldOfferNativeShareShortcut } from "./civic-share-native-policy";

const SHARE_ICON = "/icons/messenger/share.svg";
const FACEBOOK_ICON = "/icons/civic/icons8-facebook.svg";
const INSTAGRAM_ICON = "/icons/civic/icons8-instagram.svg";
const LINKEDIN_ICON = "/icons/civic/icons8-linkedin.svg";
const X_ICON = "/icons/civic/icons8-x.svg";
const EMAIL_ICON = "/icons/messenger/letter.svg";

export interface CivicShareButtonProps {
  readonly payload: CivicSharePayload | null;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly className?: string;
  readonly compact?: boolean;
  /** When true, stop click propagation (card share). */
  readonly stopPropagation?: boolean;
  readonly ariaLabel?: string;
}

type ShareOption = {
  readonly channel: Exclude<CivicShareChannel, "native">;
  readonly label: string;
  readonly icon: string;
};

const BASE_OPTIONS: readonly ShareOption[] = [
  { channel: "facebook", label: "Facebook", icon: FACEBOOK_ICON },
  { channel: "x", label: "X", icon: X_ICON },
  { channel: "linkedin", label: "LinkedIn", icon: LINKEDIN_ICON },
  { channel: "instagram", label: "Instagram", icon: INSTAGRAM_ICON },
  { channel: "email", label: "Email", icon: EMAIL_ICON },
  { channel: "copy", label: "Copy link", icon: SHARE_ICON },
];

function resolvePopoverStyle(trigger: HTMLElement | null): CSSProperties {
  if (!trigger || typeof window === "undefined") {
    return { position: "fixed", top: 0, left: 0, visibility: "hidden" };
  }

  const rect = trigger.getBoundingClientRect();
  const gap = 6;
  const width = Math.min(264, window.innerWidth - 24);
  let left = rect.right - width;
  left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
  const belowTop = rect.bottom + gap;
  const estimatedHeight = 320;
  const openAbove = belowTop + estimatedHeight > window.innerHeight && rect.top > estimatedHeight;
  const top = openAbove ? Math.max(12, rect.top - gap) : belowTop;

  return {
    position: "fixed",
    top: openAbove ? undefined : top,
    bottom: openAbove ? window.innerHeight - rect.top + gap : undefined,
    left,
    width,
    zIndex: 1200,
  };
}

/**
 * One reusable civic share trigger + portaled popover for Initiative,
 * Petition, and compact public cards.
 *
 * Share Fix 01 — the main trigger only toggles the popover. `navigator.share`
 * runs only after an explicit channel choice (native shortcut or Instagram).
 */
export function CivicShareButton({
  payload,
  disabled = false,
  disabledReason,
  className,
  compact = false,
  stopPropagation = false,
  ariaLabel,
}: CivicShareButtonProps) {
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const [showNativeShortcut, setShowNativeShortcut] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [popoverInteractive, setPopoverInteractive] = useState(false);
  const [mounted, setMounted] = useState(false);

  const shareAllowed = Boolean(payload && isCivicSharePayloadPublic(payload) && !disabled);
  const label = ariaLabel ?? (payload ? `Share ${payload.title}` : "Share unavailable");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!payload || typeof navigator === "undefined") {
      setNativeAvailable(false);
      return;
    }
    const absoluteUrl = resolveAbsoluteCivicShareUrl(payload.url);
    const data = buildWebShareData(payload, absoluteUrl);
    setNativeAvailable(canUseWebShareApi(navigator, data));
    setShowNativeShortcut(shouldOfferNativeShareShortcut());
  }, [payload]);

  const updatePopoverPosition = useCallback(() => {
    setPopoverStyle(resolvePopoverStyle(triggerRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverInteractive(false);
      return;
    }

    updatePopoverPosition();
    // Prevent the opening click from activating the first popover option.
    const readyTimer = window.setTimeout(() => setPopoverInteractive(true), 180);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) {
        return;
      }
      const popover = document.getElementById(popoverId);
      if (popover?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, popoverId]);

  function stopCardNavigation(event: { preventDefault: () => void; stopPropagation: () => void }) {
    if (!stopPropagation) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function stopCardBubble(event: { stopPropagation: () => void }) {
    if (!stopPropagation) {
      return;
    }
    event.stopPropagation();
  }

  async function handleOption(channel: Exclude<CivicShareChannel, "native">) {
    if (!payload || !shareAllowed || !popoverInteractive) {
      return;
    }

    const result = await shareCivicChannel(channel, payload);
    if (result.ok) {
      setStatus(result.detail ?? (channel === "copy" ? "Link copied" : null));
      if (channel !== "copy" && channel !== "instagram") {
        setOpen(false);
      }
    } else if (result.reason !== "cancelled") {
      setStatus(result.reason);
    }
  }

  async function handleNativeShare() {
    if (!payload || !shareAllowed || !popoverInteractive) {
      return;
    }
    const result = await shareCivicViaNative(payload);
    if (result.ok) {
      setOpen(false);
      setStatus(null);
    } else if (result.reason !== "cancelled") {
      setStatus(result.reason);
    }
  }

  const popover =
    open && payload && shareAllowed && mounted
      ? createPortal(
          <div
            id={popoverId}
            className={`civic-share__popover${popoverInteractive ? "" : " civic-share__popover--arming"}`}
            role="dialog"
            aria-label={`Share options for ${payload.title}`}
            style={popoverStyle}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <p className="civic-share__heading">Share</p>
            {nativeAvailable && showNativeShortcut ? (
              <button
                type="button"
                className="civic-share__option civic-share__option--native"
                disabled={!popoverInteractive}
                onClick={() => void handleNativeShare()}
              >
                <Image src={SHARE_ICON} alt="" width={18} height={18} aria-hidden />
                <span>Share via device…</span>
              </button>
            ) : null}
            <ul className="civic-share__options">
              {BASE_OPTIONS.map((option) => (
                <li key={option.channel}>
                  <button
                    type="button"
                    className="civic-share__option"
                    disabled={!popoverInteractive}
                    onClick={() => void handleOption(option.channel)}
                  >
                    <Image src={option.icon} alt="" width={18} height={18} aria-hidden />
                    <span>{option.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            {status ? (
              <p className="civic-share__status" role="status">
                {status}
              </p>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={["civic-share", compact ? "civic-share--compact" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        ref={triggerRef}
        type="button"
        className="civic-share__trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        title={shareAllowed ? "Share" : disabledReason || "Share unavailable"}
        disabled={!shareAllowed}
        onClick={(event) => {
          // Desktop + card: open civic popover only — never invoke Web Share API here.
          stopCardNavigation(event);
          if (!shareAllowed) {
            return;
          }
          setStatus(null);
          setOpen((current) => !current);
        }}
        onMouseDown={stopCardBubble}
        onPointerDown={stopCardBubble}
      >
        <Image src={SHARE_ICON} alt="" width={compact ? 16 : 18} height={compact ? 16 : 18} aria-hidden />
      </button>
      {popover}
    </div>
  );
}

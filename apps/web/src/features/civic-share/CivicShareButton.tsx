"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import type { CivicSharePayload } from "./civic-share.types";
import { isCivicSharePayloadPublic } from "./civic-share.types";
import {
  canUseWebShareApi,
  buildWebShareData,
  resolveAbsoluteCivicShareUrl,
} from "./civic-share.urls";
import { shareCivicChannel, shareCivicViaNative, type CivicShareChannel } from "./civic-share.actions";

import "./civic-share.css";

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

/**
 * One reusable civic share trigger + anchored popover for Initiative,
 * Petition, and compact public cards.
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
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState(false);

  const shareAllowed = Boolean(payload && isCivicSharePayloadPublic(payload) && !disabled);
  const label = ariaLabel ?? (payload ? `Share ${payload.title}` : "Share unavailable");

  useEffect(() => {
    if (!payload || typeof navigator === "undefined") {
      setNativeAvailable(false);
      return;
    }
    const absoluteUrl = resolveAbsoluteCivicShareUrl(payload.url);
    const data = buildWebShareData(payload, absoluteUrl);
    setNativeAvailable(canUseWebShareApi(navigator, data));
  }, [payload]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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
  }, [open]);

  async function handleOption(channel: Exclude<CivicShareChannel, "native">) {
    if (!payload || !shareAllowed) {
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
    if (!payload || !shareAllowed) {
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

  return (
    <div
      ref={rootRef}
      className={["civic-share", compact ? "civic-share--compact" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="civic-share__trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        title={shareAllowed ? "Share" : disabledReason || "Share unavailable"}
        disabled={!shareAllowed}
        onClick={(event) => {
          if (stopPropagation) {
            event.preventDefault();
            event.stopPropagation();
          }
          if (!shareAllowed) {
            return;
          }
          setStatus(null);
          setOpen((current) => !current);
        }}
      >
        <Image src={SHARE_ICON} alt="" width={compact ? 16 : 18} height={compact ? 16 : 18} aria-hidden />
      </button>

      {open && payload && shareAllowed ? (
        <div
          id={popoverId}
          className="civic-share__popover"
          role="dialog"
          aria-label={`Share options for ${payload.title}`}
          onClick={(event) => {
            if (stopPropagation) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <p className="civic-share__heading">Share</p>
          {nativeAvailable ? (
            <button
              type="button"
              className="civic-share__option civic-share__option--native"
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
        </div>
      ) : null}
    </div>
  );
}

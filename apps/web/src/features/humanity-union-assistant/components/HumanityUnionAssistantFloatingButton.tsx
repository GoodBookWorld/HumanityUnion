"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useOptionalHumanityUnionAssistant } from "../assistant-context";
import { resolveAssistantLaunchContext } from "../resolve-assistant-surface";

import "../humanity-union-assistant.css";

/**
 * Global floating launcher for pages without the Workspace Assistant Widget.
 */
export function HumanityUnionAssistantFloatingButton() {
  const t = useTranslations("initiativeExperience");
  const assistant = useOptionalHumanityUnionAssistant();
  const pathname = usePathname() ?? "/";
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [hash, setHash] = useState("");

  useEffect(() => {
    function syncHash() {
      setHash(typeof window !== "undefined" ? window.location.hash : "");
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  if (!assistant || assistant.hasDedicatedWidget) {
    return null;
  }

  const launch = resolveAssistantLaunchContext(pathname, hash);
  const open = assistant.isOpen;
  const title = t("assistant.entry.title");
  const openAria = t("assistant.entry.openAria");

  return (
    <button
      ref={buttonRef}
      type="button"
      className={[
        "hu-assistant-fab",
        open ? "hu-assistant-fab--open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={openAria}
      title={title}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() =>
        assistant.openAssistant({
          ...launch,
          returnFocusRef: buttonRef,
        })
      }
    >
      <img
        src="/icons/workspace/intel.webp"
        alt=""
        width={28}
        height={28}
        className="hu-assistant-fab__icon"
        decoding="async"
        loading="lazy"
        fetchPriority="low"
        aria-hidden="true"
      />
    </button>
  );
}

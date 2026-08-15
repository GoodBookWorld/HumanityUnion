"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

import { trapTabKey } from "../focus-trap";
import { Button } from "./Button";

import "./confirm-dialog.css";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: ReactNode;
  /** Label for the non-destructive, always-safe option. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Label for the destructive/confirming action (e.g. "Delete Draft"). */
  confirmLabel: string;
  /** When true, the confirm button uses the `danger` Button variant. Defaults to true. */
  destructive?: boolean;
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Initiative UX Pack 01.1 Part 4/9 — a small, generic, fully accessible
 * confirmation dialog for irreversible actions across the platform.
 *
 * Launch Readiness Pack 05 — restores focus to the opener on close and shares
 * the Design System focus-trap helper with other dialogs/menus.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  cancelLabel = "Cancel",
  confirmLabel,
  destructive = true,
  isConfirming = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (dialogRef.current) {
        trapTabKey(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      const restore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (restore && typeof restore.focus === "function") {
        restore.focus();
      }
    };
  }, [isOpen, onCancel]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="hu-confirm-dialog__backdrop" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="hu-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="hu-confirm-dialog__title">
          {title}
        </h2>
        <div id={descriptionId} className="hu-confirm-dialog__description">
          {description}
        </div>

        <div className="hu-confirm-dialog__actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="hu-button hu-button--secondary"
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <Button
            type="button"
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={isConfirming}
            ariaLive="polite"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

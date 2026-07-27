"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import {
  AVATAR_CROP_OUTPUT_SIZE,
  createDefaultAvatarCropTransform,
  renderAvatarCropBlob,
  type AvatarCropSource,
  type AvatarCropTransform,
} from "../avatar-crop";

import "./avatar-crop-editor.css";

const VIEWPORT_SIZE = 280;
const MIN_SCALE = 0.5;
const MAX_SCALE = 4;

interface AvatarCropEditorProps {
  source: AvatarCropSource;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void>;
}

export function AvatarCropEditor({ source, onCancel, onSave }: AvatarCropEditorProps) {
  const [transform, setTransform] = useState<AvatarCropTransform>(() =>
    createDefaultAvatarCropTransform(source.width, source.height, VIEWPORT_SIZE),
  );
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragOrigin = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(
    null,
  );

  const resetTransform = useCallback(() => {
    setTransform(createDefaultAvatarCropTransform(source.width, source.height, VIEWPORT_SIZE));
  }, [source.height, source.width]);

  useEffect(() => {
    resetTransform();
  }, [resetTransform, source.objectUrl]);

  function updateScale(nextScale: number) {
    setTransform((current) => ({
      ...current,
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale)),
    }));
  }

  function nudgeTransform(deltaX: number, deltaY: number) {
    setTransform((current) => ({
      ...current,
      offsetX: current.offsetX + deltaX,
      offsetY: current.offsetY + deltaY,
    }));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
    };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragOrigin.current) {
      return;
    }

    const deltaX = event.clientX - dragOrigin.current.x;
    const deltaY = event.clientY - dragOrigin.current.y;

    setTransform((current) => ({
      ...current,
      offsetX: dragOrigin.current!.offsetX + deltaX,
      offsetY: dragOrigin.current!.offsetY + deltaY,
    }));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragOrigin.current = null;
    setDragging(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const blob = await renderAvatarCropBlob({
        sourceUrl: source.objectUrl,
        sourceWidth: source.width,
        sourceHeight: source.height,
        transform,
        viewportSize: VIEWPORT_SIZE,
        outputSize: AVATAR_CROP_OUTPUT_SIZE,
      });
      await onSave(blob);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save avatar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="avatar-crop-editor"
      role="dialog"
      aria-modal="true"
      aria-label="Avatar crop editor"
    >
      <p className="avatar-crop-editor__instructions">
        Drag the image to position it. Use zoom controls to adjust framing. The circular preview
        matches how your avatar appears across the platform.
      </p>

      <div className="avatar-crop-editor__viewport-shell">
        <div
          className={
            dragging
              ? "avatar-crop-editor__viewport avatar-crop-editor__viewport--dragging"
              : "avatar-crop-editor__viewport"
          }
          style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              nudgeTransform(-8, 0);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              nudgeTransform(8, 0);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              nudgeTransform(0, -8);
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              nudgeTransform(0, 8);
            }
          }}
        >
          <img
            src={source.objectUrl}
            alt=""
            draggable={false}
            className="avatar-crop-editor__image"
            style={{
              width: source.width,
              height: source.height,
              transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
              transformOrigin: "top left",
            }}
          />
          <div className="avatar-crop-editor__grid" aria-hidden="true" />
          <div className="avatar-crop-editor__mask" aria-hidden="true" />
        </div>
      </div>

      <label className="avatar-crop-editor__zoom">
        <span>Zoom</span>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step="0.01"
          value={transform.scale}
          onChange={(event) => updateScale(Number(event.target.value))}
        />
      </label>

      <div className="avatar-crop-editor__actions">
        <Button type="button" variant="secondary" disabled={saving} onClick={resetTransform}>
          Reset
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Saving Avatar…" : "Save Avatar"}
        </Button>
      </div>

      {error ? (
        <p className="avatar-crop-editor__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

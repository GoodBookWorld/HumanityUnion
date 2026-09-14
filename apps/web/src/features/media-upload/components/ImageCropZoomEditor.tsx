"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../design-system/components/Button";
import {
  centerImageCropTransform,
  centeredZoomSliderFromScale,
  clampImageCropTransform,
  createDefaultImageCropTransform,
  renderImageCropBlob,
  resolveImageCropZoomRange,
  scaleFromCenteredZoomSlider,
  type ImageCropFrame,
  type ImageCropTransform,
} from "../image-crop-zoom";

import "./image-crop-zoom-editor.css";

export interface ImageCropZoomSource {
  objectUrl: string;
  width: number;
  height: number;
}

export interface ImageCropZoomEditorProps {
  source: ImageCropZoomSource;
  frame: ImageCropFrame;
  /** Circular mask for avatar; rectangular for cover. */
  mask: "circle" | "rect";
  ariaLabel: string;
  instructions: string;
  saveLabel: string;
  savingLabel: string;
  /** Optional; defaults keep Profile/avatar callers English-stable. */
  cancelLabel?: string;
  resetLabel?: string;
  zoomHint?: string;
  outputWidth: number;
  outputHeight: number;
  outputMimeType?: string;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void>;
}

/**
 * Pack 22D — shared crop / drag / centered-zoom editor for Profile + Initiative Cover.
 */
export function ImageCropZoomEditor({
  source,
  frame,
  mask,
  ariaLabel,
  instructions,
  saveLabel,
  savingLabel,
  cancelLabel = "Cancel",
  resetLabel = "Reset",
  zoomHint = "Out · Default · In",
  outputWidth,
  outputHeight,
  outputMimeType = "image/webp",
  onCancel,
  onSave,
}: ImageCropZoomEditorProps) {
  const range = useMemo(
    () => resolveImageCropZoomRange(source.width, source.height, frame),
    [frame, source.height, source.width],
  );

  const [transform, setTransform] = useState<ImageCropTransform>(() =>
    createDefaultImageCropTransform(source.width, source.height, frame),
  );
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragOrigin = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(
    null,
  );

  const resetTransform = useCallback(() => {
    setTransform(createDefaultImageCropTransform(source.width, source.height, frame));
  }, [frame, source.height, source.width]);

  useEffect(() => {
    resetTransform();
  }, [resetTransform, source.objectUrl]);

  const sliderValue = centeredZoomSliderFromScale(transform.scale, range);

  function applyTransform(next: ImageCropTransform) {
    setTransform(clampImageCropTransform(source.width, source.height, frame, next, range));
  }

  function updateScaleFromSlider(sliderT: number) {
    const scale = scaleFromCenteredZoomSlider(sliderT, range);
    applyTransform({
      ...transform,
      scale,
    });
  }

  function nudgeTransform(deltaX: number, deltaY: number) {
    applyTransform({
      ...transform,
      offsetX: transform.offsetX + deltaX,
      offsetY: transform.offsetY + deltaY,
    });
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
    applyTransform({
      ...transform,
      offsetX: dragOrigin.current.offsetX + deltaX,
      offsetY: dragOrigin.current.offsetY + deltaY,
    });
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
      const blob = await renderImageCropBlob({
        sourceUrl: source.objectUrl,
        sourceWidth: source.width,
        sourceHeight: source.height,
        transform,
        frame,
        outputWidth,
        outputHeight,
        mimeType: outputMimeType,
      });
      await onSave(blob);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save cropped image.");
    } finally {
      setSaving(false);
    }
  }

  const zoomPercent = Math.round((transform.scale / range.defaultScale) * 100);

  return (
    <div
      className="image-crop-zoom-editor"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <p className="image-crop-zoom-editor__instructions">{instructions}</p>

      <div className="image-crop-zoom-editor__viewport-shell">
        <div
          className={[
            "image-crop-zoom-editor__viewport",
            mask === "circle"
              ? "image-crop-zoom-editor__viewport--circle"
              : "image-crop-zoom-editor__viewport--rect",
            dragging ? "image-crop-zoom-editor__viewport--dragging" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ width: frame.width, height: frame.height }}
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
            className="image-crop-zoom-editor__image"
            style={{
              width: source.width,
              height: source.height,
              transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.scale})`,
              transformOrigin: "top left",
            }}
          />
          <div className="image-crop-zoom-editor__grid" aria-hidden="true" />
          <div
            className={
              mask === "circle"
                ? "image-crop-zoom-editor__mask image-crop-zoom-editor__mask--circle"
                : "image-crop-zoom-editor__mask image-crop-zoom-editor__mask--rect"
            }
            aria-hidden="true"
          />
        </div>
      </div>

      <label className="image-crop-zoom-editor__zoom">
        <span>Zoom</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={sliderValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sliderValue * 100)}
          aria-valuetext={`${zoomPercent}% of default framing`}
          onChange={(event) => updateScaleFromSlider(Number(event.target.value))}
        />
        <span className="image-crop-zoom-editor__zoom-hint" aria-hidden="true">
          {zoomHint}
        </span>
      </label>

      <div className="image-crop-zoom-editor__actions">
        <Button
          type="button"
          variant="secondary"
          disabled={saving}
          onClick={() =>
            applyTransform(centerImageCropTransform(source.width, source.height, frame, range.defaultScale))
          }
        >
          {resetLabel}
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? savingLabel : saveLabel}
        </Button>
      </div>

      {error ? (
        <p className="image-crop-zoom-editor__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

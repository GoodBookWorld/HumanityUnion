"use client";

import {
  AVATAR_CROP_OUTPUT_SIZE,
  AVATAR_CROP_VIEWPORT_SIZE,
  type AvatarCropSource,
} from "../avatar-crop";
import { ImageCropZoomEditor } from "./ImageCropZoomEditor";

interface AvatarCropEditorProps {
  source: AvatarCropSource;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void>;
}

/**
 * Pack 22D — Profile avatar crop uses the shared ImageCropZoomEditor (1:1 circle).
 */
export function AvatarCropEditor({ source, onCancel, onSave }: AvatarCropEditorProps) {
  return (
    <ImageCropZoomEditor
      source={source}
      frame={{ width: AVATAR_CROP_VIEWPORT_SIZE, height: AVATAR_CROP_VIEWPORT_SIZE }}
      mask="circle"
      ariaLabel="Avatar crop editor"
      instructions="Drag the image to position it. Use Zoom to adjust framing — left zooms out, center is the default crop, right zooms in. The circular preview matches how your avatar appears across the platform."
      saveLabel="Save Avatar"
      savingLabel="Saving Avatar…"
      outputWidth={AVATAR_CROP_OUTPUT_SIZE}
      outputHeight={AVATAR_CROP_OUTPUT_SIZE}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

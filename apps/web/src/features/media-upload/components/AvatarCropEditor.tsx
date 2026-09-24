"use client";

import { useTranslations } from "next-intl";

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
  const t = useTranslations("memberProfile.avatar");

  return (
    <ImageCropZoomEditor
      source={source}
      frame={{ width: AVATAR_CROP_VIEWPORT_SIZE, height: AVATAR_CROP_VIEWPORT_SIZE }}
      mask="circle"
      ariaLabel={t("cropAria")}
      instructions={t("cropInstructions")}
      saveLabel={t("cropSave")}
      savingLabel={t("cropSaving")}
      outputWidth={AVATAR_CROP_OUTPUT_SIZE}
      outputHeight={AVATAR_CROP_OUTPUT_SIZE}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

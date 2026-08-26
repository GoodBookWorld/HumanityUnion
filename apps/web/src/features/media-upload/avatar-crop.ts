import {
  createDefaultImageCropTransform,
  renderImageCropBlob,
  type ImageCropTransform,
} from "./image-crop-zoom";

export const AVATAR_CROP_OUTPUT_SIZE = 512;
export const AVATAR_CROP_VIEWPORT_SIZE = 280;
export const AVATAR_MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIN_SOURCE_DIMENSION = 128;

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type AvatarCropTransform = ImageCropTransform;

export interface AvatarCropSource {
  objectUrl: string;
  width: number;
  height: number;
}

export function validateAvatarSourceFile(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Unsupported image type. Allowed formats: JPEG, PNG, WEBP.");
  }

  if (file.size > AVATAR_MAX_SOURCE_BYTES) {
    throw new Error("Image exceeds the 2 MB size limit.");
  }

  if (file.size === 0) {
    throw new Error("Uploaded image is empty.");
  }
}

export async function loadAvatarCropSource(file: File): Promise<AvatarCropSource> {
  validateAvatarSourceFile(file);

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);

    if (
      image.naturalWidth < AVATAR_MIN_SOURCE_DIMENSION ||
      image.naturalHeight < AVATAR_MIN_SOURCE_DIMENSION
    ) {
      throw new Error(
        `Image must be at least ${AVATAR_MIN_SOURCE_DIMENSION}×${AVATAR_MIN_SOURCE_DIMENSION} pixels.`,
      );
    }

    return {
      objectUrl,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error instanceof Error ? error : new Error("Unable to read image file.");
  }
}

/** Pack 22D — default uses shared centered-zoom default (cover-min × 1.2). */
export function createDefaultAvatarCropTransform(
  sourceWidth: number,
  sourceHeight: number,
  viewportSize: number = AVATAR_CROP_VIEWPORT_SIZE,
): AvatarCropTransform {
  return createDefaultImageCropTransform(sourceWidth, sourceHeight, {
    width: viewportSize,
    height: viewportSize,
  });
}

export async function renderAvatarCropBlob(input: {
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  transform: AvatarCropTransform;
  viewportSize: number;
  outputSize?: number;
}): Promise<Blob> {
  const outputSize = input.outputSize ?? AVATAR_CROP_OUTPUT_SIZE;
  return renderImageCropBlob({
    sourceUrl: input.sourceUrl,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    transform: input.transform,
    frame: { width: input.viewportSize, height: input.viewportSize },
    outputWidth: outputSize,
    outputHeight: outputSize,
    mimeType: "image/webp",
    quality: 0.92,
  });
}

export function avatarCropBlobToFile(blob: Blob): File {
  return new File([blob], "avatar.webp", { type: "image/webp" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read image file."));
    image.src = src;
  });
}

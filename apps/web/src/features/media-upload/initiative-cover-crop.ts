import {
  createDefaultImageCropTransform,
  renderImageCropBlob,
  type ImageCropFrame,
  type ImageCropTransform,
} from "./image-crop-zoom";

export const INITIATIVE_COVER_CROP_FRAME: ImageCropFrame = { width: 320, height: 180 };
export const INITIATIVE_COVER_OUTPUT_WIDTH = 1280;
export const INITIATIVE_COVER_OUTPUT_HEIGHT = 720;
export const INITIATIVE_COVER_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const INITIATIVE_COVER_MIN_SOURCE_DIMENSION = 128;

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type InitiativeCoverCropTransform = ImageCropTransform;

export interface InitiativeCoverCropSource {
  objectUrl: string;
  width: number;
  height: number;
}

export function validateInitiativeCoverSourceFile(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Unsupported image type. Allowed formats: JPEG, PNG, WEBP.");
  }

  if (file.size > INITIATIVE_COVER_MAX_SOURCE_BYTES) {
    throw new Error("Image exceeds the 5 MB size limit.");
  }

  if (file.size === 0) {
    throw new Error("Uploaded image is empty.");
  }
}

export async function loadInitiativeCoverCropSource(
  file: File,
): Promise<InitiativeCoverCropSource> {
  validateInitiativeCoverSourceFile(file);

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);

    if (
      image.naturalWidth < INITIATIVE_COVER_MIN_SOURCE_DIMENSION ||
      image.naturalHeight < INITIATIVE_COVER_MIN_SOURCE_DIMENSION
    ) {
      throw new Error(
        `Image must be at least ${INITIATIVE_COVER_MIN_SOURCE_DIMENSION}×${INITIATIVE_COVER_MIN_SOURCE_DIMENSION} pixels.`,
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

export function createDefaultInitiativeCoverCropTransform(
  sourceWidth: number,
  sourceHeight: number,
  frame: ImageCropFrame = INITIATIVE_COVER_CROP_FRAME,
): InitiativeCoverCropTransform {
  return createDefaultImageCropTransform(sourceWidth, sourceHeight, frame);
}

export async function renderInitiativeCoverCropBlob(input: {
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  transform: InitiativeCoverCropTransform;
  frame?: ImageCropFrame;
}): Promise<Blob> {
  const frame = input.frame ?? INITIATIVE_COVER_CROP_FRAME;
  return renderImageCropBlob({
    sourceUrl: input.sourceUrl,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    transform: input.transform,
    frame,
    outputWidth: INITIATIVE_COVER_OUTPUT_WIDTH,
    outputHeight: INITIATIVE_COVER_OUTPUT_HEIGHT,
    mimeType: "image/webp",
    quality: 0.92,
  });
}

export function initiativeCoverCropBlobToFile(blob: Blob): File {
  return new File([blob], "initiative-cover.webp", { type: "image/webp" });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to read image file."));
    image.src = src;
  });
}

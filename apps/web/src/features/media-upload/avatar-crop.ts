export const AVATAR_CROP_OUTPUT_SIZE = 512;
export const AVATAR_MAX_SOURCE_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIN_SOURCE_DIMENSION = 128;

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface AvatarCropTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

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

export function createDefaultAvatarCropTransform(
  sourceWidth: number,
  sourceHeight: number,
  viewportSize: number,
): AvatarCropTransform {
  const scale = Math.max(viewportSize / sourceWidth, viewportSize / sourceHeight);

  return {
    scale,
    offsetX: (viewportSize - sourceWidth * scale) / 2,
    offsetY: (viewportSize - sourceHeight * scale) / 2,
  };
}

export async function renderAvatarCropBlob(input: {
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  transform: AvatarCropTransform;
  viewportSize: number;
  outputSize?: number;
}): Promise<Blob> {
  const image = await loadImage(input.sourceUrl);
  const canvas = document.createElement("canvas");
  const outputSize = input.outputSize ?? AVATAR_CROP_OUTPUT_SIZE;
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare avatar crop.");
  }

  const scaleFactor = outputSize / input.viewportSize;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, outputSize, outputSize);
  context.drawImage(
    image,
    input.transform.offsetX * scaleFactor,
    input.transform.offsetY * scaleFactor,
    input.sourceWidth * input.transform.scale * scaleFactor,
    input.sourceHeight * input.transform.scale * scaleFactor,
  );

  const blob = await canvasToBlob(canvas, "image/webp", 0.92);

  if (!blob) {
    throw new Error("Unable to generate cropped avatar.");
  }

  return blob;
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

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

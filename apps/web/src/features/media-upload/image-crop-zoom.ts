/**
 * Pack 22D — shared image crop / position / centered-zoom math.
 *
 * Used by Profile avatar (1:1) and Initiative cover (16:9).
 * Zoom slider midpoint maps to the default (slightly-in from cover-min) scale.
 * Absolute min scale is always cover-fit so the crop never shows empty canvas.
 */

export interface ImageCropFrame {
  width: number;
  height: number;
}

export interface ImageCropTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ImageCropZoomRange {
  /** Minimum scale that still fully covers the frame (no empty edges). */
  minScale: number;
  /** Default / natural edit state (slider midpoint). */
  defaultScale: number;
  /** Maximum zoom-in scale. */
  maxScale: number;
}

/** Relative zoom-out/in around cover-min. default = cover * DEFAULT_ZOOM_FACTOR. */
export const IMAGE_CROP_DEFAULT_ZOOM_FACTOR = 1.2;
export const IMAGE_CROP_MAX_ZOOM_FACTOR = 3;

/**
 * Minimum scale so the image fully covers the crop frame (object-fit: cover).
 */
export function computeCoverMinScale(
  sourceWidth: number,
  sourceHeight: number,
  frame: ImageCropFrame,
): number {
  if (sourceWidth <= 0 || sourceHeight <= 0 || frame.width <= 0 || frame.height <= 0) {
    return 1;
  }
  return Math.max(frame.width / sourceWidth, frame.height / sourceHeight);
}

export function resolveImageCropZoomRange(
  sourceWidth: number,
  sourceHeight: number,
  frame: ImageCropFrame,
): ImageCropZoomRange {
  const minScale = computeCoverMinScale(sourceWidth, sourceHeight, frame);
  const defaultScale = minScale * IMAGE_CROP_DEFAULT_ZOOM_FACTOR;
  const maxScale = minScale * IMAGE_CROP_MAX_ZOOM_FACTOR;
  return { minScale, defaultScale, maxScale };
}

export function createDefaultImageCropTransform(
  sourceWidth: number,
  sourceHeight: number,
  frame: ImageCropFrame,
): ImageCropTransform {
  const { defaultScale } = resolveImageCropZoomRange(sourceWidth, sourceHeight, frame);
  return centerImageCropTransform(sourceWidth, sourceHeight, frame, defaultScale);
}

export function centerImageCropTransform(
  sourceWidth: number,
  sourceHeight: number,
  frame: ImageCropFrame,
  scale: number,
): ImageCropTransform {
  return {
    scale,
    offsetX: (frame.width - sourceWidth * scale) / 2,
    offsetY: (frame.height - sourceHeight * scale) / 2,
  };
}

/**
 * Clamp offsets so the scaled image still covers the entire frame.
 */
export function clampImageCropTransform(
  sourceWidth: number,
  sourceHeight: number,
  frame: ImageCropFrame,
  transform: ImageCropTransform,
  range: ImageCropZoomRange,
): ImageCropTransform {
  const scale = Math.min(range.maxScale, Math.max(range.minScale, transform.scale));
  const scaledW = sourceWidth * scale;
  const scaledH = sourceHeight * scale;

  let offsetX = transform.offsetX;
  let offsetY = transform.offsetY;

  if (scaledW <= frame.width) {
    offsetX = (frame.width - scaledW) / 2;
  } else {
    const minX = frame.width - scaledW;
    offsetX = Math.min(0, Math.max(minX, offsetX));
  }

  if (scaledH <= frame.height) {
    offsetY = (frame.height - scaledH) / 2;
  } else {
    const minY = frame.height - scaledH;
    offsetY = Math.min(0, Math.max(minY, offsetY));
  }

  return { scale, offsetX, offsetY };
}

/**
 * Map slider position t ∈ [0, 1] to scale.
 * t = 0.5 → defaultScale (visual midpoint).
 * t < 0.5 → zoom out toward minScale.
 * t > 0.5 → zoom in toward maxScale.
 */
export function scaleFromCenteredZoomSlider(
  sliderT: number,
  range: ImageCropZoomRange,
): number {
  const t = Math.min(1, Math.max(0, sliderT));
  if (t <= 0.5) {
    const local = t / 0.5;
    return range.minScale + (range.defaultScale - range.minScale) * local;
  }
  const local = (t - 0.5) / 0.5;
  return range.defaultScale + (range.maxScale - range.defaultScale) * local;
}

export function centeredZoomSliderFromScale(
  scale: number,
  range: ImageCropZoomRange,
): number {
  if (scale <= range.defaultScale) {
    const span = range.defaultScale - range.minScale;
    if (span <= 0) {
      return 0.5;
    }
    return 0.5 * ((scale - range.minScale) / span);
  }
  const span = range.maxScale - range.defaultScale;
  if (span <= 0) {
    return 0.5;
  }
  return 0.5 + 0.5 * ((scale - range.defaultScale) / span);
}

/** True when slider midpoint yields the default scale (within epsilon). */
export function isCenteredZoomMidpointDefault(range: ImageCropZoomRange, epsilon = 1e-6): boolean {
  const mid = scaleFromCenteredZoomSlider(0.5, range);
  return Math.abs(mid - range.defaultScale) <= epsilon;
}

/**
 * Normalized pan within the movable range for a given scale.
 * 0.5 / 0.5 = centered. Values are stable across viewport pixel sizes of the same aspect.
 */
export function normalizeImageCropPosition(
  sourceWidth: number,
  sourceHeight: number,
  frame: ImageCropFrame,
  transform: ImageCropTransform,
): { x: number; y: number } {
  const scaledW = sourceWidth * transform.scale;
  const scaledH = sourceHeight * transform.scale;
  const minX = frame.width - scaledW;
  const minY = frame.height - scaledH;
  const rangeX = 0 - minX;
  const rangeY = 0 - minY;
  return {
    x: rangeX <= 0 ? 0.5 : (transform.offsetX - minX) / rangeX,
    y: rangeY <= 0 ? 0.5 : (transform.offsetY - minY) / rangeY,
  };
}

/** True when the scaled image fully covers the crop frame (no empty canvas). */
export function imageCropFullyCoversFrame(
  sourceWidth: number,
  sourceHeight: number,
  frame: ImageCropFrame,
  transform: ImageCropTransform,
  epsilon = 1e-6,
): boolean {
  const scaledW = sourceWidth * transform.scale;
  const scaledH = sourceHeight * transform.scale;
  if (scaledW + epsilon < frame.width || scaledH + epsilon < frame.height) {
    return false;
  }
  if (transform.offsetX > epsilon || transform.offsetY > epsilon) {
    return false;
  }
  if (transform.offsetX + scaledW + epsilon < frame.width) {
    return false;
  }
  if (transform.offsetY + scaledH + epsilon < frame.height) {
    return false;
  }
  return true;
}

export async function renderImageCropBlob(input: {
  sourceUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  transform: ImageCropTransform;
  frame: ImageCropFrame;
  outputWidth: number;
  outputHeight: number;
  mimeType?: string;
  quality?: number;
}): Promise<Blob> {
  const image = await loadCropImage(input.sourceUrl);
  const canvas = document.createElement("canvas");
  canvas.width = input.outputWidth;
  canvas.height = input.outputHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare image crop.");
  }

  const scaleX = input.outputWidth / input.frame.width;
  const scaleY = input.outputHeight / input.frame.height;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, input.outputWidth, input.outputHeight);
  context.drawImage(
    image,
    input.transform.offsetX * scaleX,
    input.transform.offsetY * scaleY,
    input.sourceWidth * input.transform.scale * scaleX,
    input.sourceHeight * input.transform.scale * scaleY,
  );

  const mimeType = input.mimeType ?? "image/webp";
  const quality = input.quality ?? 0.92;
  const blob = await canvasToBlob(canvas, mimeType, quality);
  if (!blob) {
    throw new Error("Unable to generate cropped image.");
  }
  return blob;
}

function loadCropImage(src: string): Promise<HTMLImageElement> {
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

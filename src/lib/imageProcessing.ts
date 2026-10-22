/**
 * Client-side image processing utilities for news images.
 * Handles resize, format conversion, and metadata extraction using Canvas API.
 */

export const TARGET_RATIO = 1024 / 671; // ≈ 1.526
export const TARGET_RATIO_LABEL = '1024 × 671';
export const VARIANT_WIDTHS = [400, 800, 1200, 1600] as const;
export const MAX_WIDTH = 1600;
export const QUALITY = 0.85;
export const RATIO_TOLERANCE = 0.08; // 8% deviation allowed

export interface ImageMeta {
  width: number;
  height: number;
  ratio: number;
  ratioDiff: number; // absolute % deviation from target
  isAcceptable: boolean;
  fileSize: number;
  fileName: string;
  mimeType: string;
}

export interface ProcessedVariant {
  width: number;
  blob: Blob;
  format: 'webp' | 'jpeg' | 'png';
  suffix: string; // e.g. "400.webp"
}

/** Read width/height from a File without rendering it visibly */
export function getImageMeta(file: File): Promise<ImageMeta> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = img.naturalWidth / img.naturalHeight;
      const ratioDiff = Math.abs(ratio - TARGET_RATIO) / TARGET_RATIO;
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        ratio,
        ratioDiff,
        isAcceptable: ratioDiff <= RATIO_TOLERANCE,
        fileSize: file.size,
        fileName: file.name,
        mimeType: file.type,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Kunne ikke lese bildedata'));
    };
    img.src = url;
  });
}

/** Load an HTMLImageElement from a File */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

/** Resize keeping aspect ratio, return canvas */
function resizeCanvas(img: HTMLImageElement, targetWidth: number): HTMLCanvasElement {
  const scale = Math.min(1, targetWidth / img.naturalWidth);
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** Crop to target ratio then resize */
function cropAndResizeCanvas(
  img: HTMLImageElement,
  targetWidth: number,
  focalY: number = 0.5, // 0-1, vertical focus
): HTMLCanvasElement {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const srcRatio = srcW / srcH;

  let cropW = srcW;
  let cropH = srcH;
  let cropX = 0;
  let cropY = 0;

  if (srcRatio > TARGET_RATIO) {
    // Too wide – crop sides
    cropW = Math.round(srcH * TARGET_RATIO);
    cropX = Math.round((srcW - cropW) / 2);
  } else {
    // Too tall – crop top/bottom using focal point
    cropH = Math.round(srcW / TARGET_RATIO);
    const maxY = srcH - cropH;
    cropY = Math.round(maxY * focalY);
  }

  const scale = Math.min(1, targetWidth / cropW);
  const outW = Math.round(cropW * scale);
  const outH = Math.round(cropH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
  return canvas;
}

/** Convert canvas to blob */
function canvasToBlob(canvas: HTMLCanvasElement, format: 'webp' | 'jpeg' | 'png', quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mimeMap = { webp: 'image/webp', jpeg: 'image/jpeg', png: 'image/png' };
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      mimeMap[format],
      quality,
    );
  });
}

/** Determine output format based on original */
function chooseFormats(mimeType: string): ('webp' | 'jpeg' | 'png')[] {
  // PNG stays PNG + WebP; everything else → JPEG + WebP
  const base: 'jpeg' | 'png' = mimeType === 'image/png' ? 'png' : 'jpeg';
  return [base, 'webp'];
}

export type CropMode = 'keep' | 'crop';

export interface GenerateVariantsOptions {
  file: File;
  mode: CropMode;
  focalY?: number; // 0-1
}

/** Generate all size variants in original format + WebP */
export async function generateVariants(opts: GenerateVariantsOptions): Promise<ProcessedVariant[]> {
  const { file, mode, focalY = 0.5 } = opts;
  const img = await loadImage(file);
  const formats = chooseFormats(file.type);
  const results: ProcessedVariant[] = [];

  for (const width of VARIANT_WIDTHS) {
    if (width > img.naturalWidth * 1.1) continue; // Don't upscale
    const canvas = mode === 'crop'
      ? cropAndResizeCanvas(img, width, focalY)
      : resizeCanvas(img, width);

    for (const fmt of formats) {
      const blob = await canvasToBlob(canvas, fmt, QUALITY);
      results.push({ width, blob, format: fmt, suffix: `${width}.${fmt}` });
    }
  }

  return results;
}

/** Generate a single preview canvas for a given mode */
export async function generatePreview(
  file: File,
  previewWidth: number,
  mode: CropMode,
  focalY: number = 0.5,
): Promise<string> {
  const img = await loadImage(file);
  const canvas = mode === 'crop'
    ? cropAndResizeCanvas(img, previewWidth, focalY)
    : resizeCanvas(img, previewWidth);
  return canvas.toDataURL('image/jpeg', 0.9);
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format ratio for display */
export function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`;
}

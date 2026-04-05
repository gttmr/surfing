"use client";

export type CompressedProfileImage = {
  blob: Blob;
  compressedBytes: number;
  height: number;
  originalBytes: number;
  previewUrl: string;
  targetSize: number;
  width: number;
};

type CompressProfileImageOptions = {
  mimeType?: "image/webp" | "image/jpeg" | "image/png";
  quality?: number;
  targetSize?: number;
};

export type ProfileImageCrop = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

export function loadImage(src: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = src;

  if (image.complete) {
    return Promise.resolve(image);
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function percentSaved(original: number, compressed: number) {
  if (original <= 0) return "0%";
  return `${Math.max(0, Math.round((1 - compressed / original) * 100))}%`;
}

export async function loadImageFromFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    return {
      image,
      objectUrl,
      width: image.naturalWidth,
      height: image.naturalHeight,
      originalBytes: file.size,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

export async function createProfileImageFromCrop(
  image: HTMLImageElement,
  originalBytes: number,
  crop: ProfileImageCrop,
  {
    targetSize = 320,
    quality = 0.78,
    mimeType = "image/webp",
  }: CompressProfileImageOptions = {},
) {
  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("브라우저 캔버스를 사용할 수 없습니다.");
  }

  const coverScale = Math.max(
    targetSize / image.naturalWidth,
    targetSize / image.naturalHeight,
  ) * crop.zoom;
  const drawWidth = image.naturalWidth * coverScale;
  const drawHeight = image.naturalHeight * coverScale;
  const drawX = (targetSize - drawWidth) / 2 + crop.offsetX * (targetSize / 240);
  const drawY = (targetSize - drawHeight) / 2 + crop.offsetY * (targetSize / 240);

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("이미지 압축에 실패했습니다."));
          return;
        }
        resolve(result);
      },
      mimeType,
      quality,
    );
  });

  return {
    blob,
    compressedBytes: blob.size,
    height: image.naturalHeight,
    originalBytes,
    previewUrl: URL.createObjectURL(blob),
    targetSize,
    width: image.naturalWidth,
  } satisfies CompressedProfileImage;
}

export async function compressProfileImageFile(
  file: File,
  {
    targetSize = 320,
    quality = 0.78,
    mimeType = "image/webp",
  }: CompressProfileImageOptions = {},
) {
  const originalUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(originalUrl);
    const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
    const offsetX = Math.floor((image.naturalWidth - cropSize) / 2);
    const offsetY = Math.floor((image.naturalHeight - cropSize) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("브라우저 캔버스를 사용할 수 없습니다.");
    }

    context.drawImage(image, offsetX, offsetY, cropSize, cropSize, 0, 0, targetSize, targetSize);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("이미지 압축에 실패했습니다."));
            return;
          }
          resolve(result);
        },
        mimeType,
        quality,
      );
    });

    return {
      blob,
      compressedBytes: blob.size,
      height: image.naturalHeight,
      originalBytes: file.size,
      previewUrl: URL.createObjectURL(blob),
      targetSize,
      width: image.naturalWidth,
    } satisfies CompressedProfileImage;
  } finally {
    URL.revokeObjectURL(originalUrl);
  }
}

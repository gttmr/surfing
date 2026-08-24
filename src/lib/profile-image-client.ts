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
  previewFrameSize?: number;
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
    previewFrameSize = 240,
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
  const drawX = (targetSize - drawWidth) / 2 + crop.offsetX * (targetSize / previewFrameSize);
  const drawY = (targetSize - drawHeight) / 2 + crop.offsetY * (targetSize / previewFrameSize);

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

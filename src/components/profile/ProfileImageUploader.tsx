"use client";

import { ChangeEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProfileImageFromCrop,
  loadImageFromFile,
  type CompressedProfileImage,
  type ProfileImageCrop,
} from "@/lib/profile-image-client";
import { pickSurfAvatarEmoji } from "@/lib/avatar-emoji";

type ProfileUserPatch = {
  customProfileImageUrl: string | null;
  kakaoProfileImage: string | null;
  profileImage: string | null;
};

export function ProfileImageUploader({
  currentImage,
  fallbackSeed,
  onUpdated,
}: {
  currentImage: string | null;
  fallbackSeed?: string | null;
  onUpdated: (user: ProfileUserPatch) => void;
}) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [cropOriginalBytes, setCropOriginalBytes] = useState(0);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
    startOffsetX: number;
    startOffsetY: number;
    startCenterX: number;
    startCenterY: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (previewImage?.startsWith("blob:")) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage]);

  useEffect(() => {
    return () => {
      if (cropSourceUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl]);

  const previewFrameSize = 260;
  const cropGuideSize = Math.round(previewFrameSize * (88 / 96));
  const cropMetrics = useMemo(() => {
    if (!cropImage) return null;
    const coverScale = Math.max(
      previewFrameSize / cropImage.naturalWidth,
      previewFrameSize / cropImage.naturalHeight,
    ) * cropZoom;
    const width = cropImage.naturalWidth * coverScale;
    const height = cropImage.naturalHeight * coverScale;
    const centeredX = (previewFrameSize - width) / 2;
    const centeredY = (previewFrameSize - height) / 2;
    return { width, height, centeredX, centeredY };
  }, [cropImage, cropZoom]);

  const clampOffset = useCallback((nextX: number, nextY: number) => {
    if (!cropMetrics) return { x: nextX, y: nextY };
    const minDrawX = previewFrameSize - cropMetrics.width;
    const maxDrawX = 0;
    const minDrawY = previewFrameSize - cropMetrics.height;
    const maxDrawY = 0;
    const nextDrawX = Math.min(maxDrawX, Math.max(minDrawX, cropMetrics.centeredX + nextX));
    const nextDrawY = Math.min(maxDrawY, Math.max(minDrawY, cropMetrics.centeredY + nextY));
    return {
      x: nextDrawX - cropMetrics.centeredX,
      y: nextDrawY - cropMetrics.centeredY,
    };
  }, [cropMetrics]);

  function clampZoom(nextZoom: number) {
    return Math.min(3, Math.max(1, nextZoom));
  }

  function getPointerPair() {
    const entries = Array.from(pointersRef.current.values());
    if (entries.length < 2) return null;
    return [entries[0], entries[1]] as const;
  }

  function resetGestureState() {
    dragRef.current = null;
    pinchRef.current = null;
  }

  useEffect(() => {
    if (!cropMetrics) return;
    setCropOffset((prev) => {
      const next = clampOffset(prev.x, prev.y);
      if (next.x === prev.x && next.y === prev.y) return prev;
      return next;
    });
  }, [clampOffset, cropMetrics]);

  function closeCropper() {
    if (cropSourceUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(cropSourceUrl);
    }
    setCropSourceUrl(null);
    setCropImage(null);
    setCropOriginalBytes(0);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    pointersRef.current.clear();
    resetGestureState();
  }

  async function uploadCompressed(compressed: CompressedProfileImage) {
    setIsUploading(true);
    setError(null);

    const file = new File([compressed.blob], "profile.webp", {
      type: compressed.blob.type,
    });
    const form = new FormData();
    form.append("file", file);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      });

      let data: { error?: string; user?: ProfileUserPatch } = {};
      try {
        data = await response.json();
      } catch {
        // 서버가 JSON이 아닌 응답을 반환한 경우
      }

      if (!response.ok) {
        throw new Error(data.error ?? "업로드에 실패했습니다.");
      }

      if (data.user) onUpdated(data.user);
      setPreviewImage((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 선택할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const loaded = await loadImageFromFile(file);
      setCropSourceUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return loaded.objectUrl;
      });
      setCropImage(loaded.image);
      setCropOriginalBytes(loaded.originalBytes);
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setIsProcessing(false);
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : "이미지 처리에 실패했습니다.");
      setIsProcessing(false);
    }

    event.target.value = "";
  }

  async function handleCropSave() {
    if (!cropImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const nextCompressed = await createProfileImageFromCrop(
        cropImage,
        cropOriginalBytes,
        {
          offsetX: cropOffset.x,
          offsetY: cropOffset.y,
          zoom: cropZoom,
        } satisfies ProfileImageCrop,
        {
          mimeType: "image/webp",
          previewFrameSize,
          quality: 0.78,
          targetSize: 320,
        },
      );

      setPreviewImage((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return nextCompressed.previewUrl;
      });
      closeCropper();
      setIsProcessing(false);
      await uploadCompressed(nextCompressed);
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : "이미지 처리에 실패했습니다.");
      setIsProcessing(false);
    }
  }

  function handleZoomChange(nextZoom: number) {
    setCropZoom(clampZoom(nextZoom));
    setCropOffset((prev) => clampOffset(prev.x, prev.y));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!cropImage) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const pointerPair = getPointerPair();
    if (pointerPair) {
      const [first, second] = pointerPair;
      pinchRef.current = {
        startDistance: Math.hypot(second.x - first.x, second.y - first.y),
        startZoom: cropZoom,
        startOffsetX: cropOffset.x,
        startOffsetY: cropOffset.y,
        startCenterX: (first.x + second.x) / 2,
        startCenterY: (first.y + second.y) / 2,
      };
      dragRef.current = null;
    } else {
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: cropOffset.x,
        originY: cropOffset.y,
      };
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const pointerPair = getPointerPair();
    if (pointerPair && pinchRef.current) {
      const [first, second] = pointerPair;
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      const nextZoom = clampZoom(
        pinchRef.current.startZoom * (distance / Math.max(1, pinchRef.current.startDistance)),
      );
      const nextOffset = clampOffset(
        pinchRef.current.startOffsetX + (centerX - pinchRef.current.startCenterX),
        pinchRef.current.startOffsetY + (centerY - pinchRef.current.startCenterY),
      );
      setCropZoom(nextZoom);
      setCropOffset(nextOffset);
      return;
    }

    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragRef.current.startX;
    const deltaY = event.clientY - dragRef.current.startY;
    setCropOffset(clampOffset(dragRef.current.originX + deltaX, dragRef.current.originY + deltaY));
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const remainingPointers = Array.from(pointersRef.current.entries());
    if (remainingPointers.length >= 2) {
      const pointerPair = getPointerPair();
      if (pointerPair) {
        const [first, second] = pointerPair;
        pinchRef.current = {
          startDistance: Math.hypot(second.x - first.x, second.y - first.y),
          startZoom: cropZoom,
          startOffsetX: cropOffset.x,
          startOffsetY: cropOffset.y,
          startCenterX: (first.x + second.x) / 2,
          startCenterY: (first.y + second.y) / 2,
        };
        dragRef.current = null;
      }
      return;
    }

    pinchRef.current = null;

    if (remainingPointers.length === 1) {
      const [pointerId, point] = remainingPointers[0];
      dragRef.current = {
        pointerId,
        startX: point.x,
        startY: point.y,
        originX: cropOffset.x,
        originY: cropOffset.y,
      };
      return;
    }

    dragRef.current = null;
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const step = event.deltaY > 0 ? -0.12 : 0.12;
    handleZoomChange(cropZoom + step);
  }

  const activeImage = previewImage ?? currentImage;
  const fallbackEmoji = pickSurfAvatarEmoji(fallbackSeed);
  return (
    <>
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="brand-avatar-shell brand-avatar-shell-large flex h-24 w-24 items-center justify-center overflow-hidden rounded-full text-[1.75rem] font-extrabold sm:h-28 sm:w-28 sm:text-3xl">
            {activeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="프로필 사진" className="h-full w-full object-cover" src={activeImage} />
            ) : (
              <span>{fallbackEmoji}</span>
            )}
          </div>

          <label
            className={`brand-avatar-action absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-95 sm:h-9 sm:w-9 ${
              isProcessing || isUploading ? "pointer-events-none opacity-70" : ""
            }`}
          >
            <span className="sr-only">프로필 사진 변경</span>
            <input
              accept="image/*"
              className="hidden"
              disabled={isProcessing || isUploading}
              onChange={handleChange}
              type="file"
            />
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 7h3l1.5-2h7L17.5 7H20a2 2 0 0 1 2 2v8.5A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5V9a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
              <circle cx="12" cy="12.5" r="3.5" strokeWidth={1.8} />
            </svg>
          </label>
        </div>

        {error ? <p className="brand-chip-danger mt-2 rounded-full px-3 py-1.5 text-xs font-semibold">{error}</p> : null}
      </div>

      {cropImage && cropSourceUrl ? (
        <div className="fixed inset-0 z-[70] bg-[var(--brand-overlay-strong)] px-4 py-6">
          <div className="brand-card-soft mx-auto mt-12 w-full max-w-[390px] rounded-3xl p-5 shadow-[0_20px_48px_var(--brand-shadow)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-extrabold text-[var(--brand-text)]">프로필 사진 다듬기</p>
              </div>
              <button
                className="brand-button-secondary flex h-9 w-9 items-center justify-center rounded-full"
                onClick={closeCropper}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="mb-4 flex flex-col items-center gap-4">
              <div
                className="brand-panel-white relative h-[260px] w-[260px] touch-none overflow-hidden rounded-[2rem]"
                onPointerCancel={handlePointerEnd}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onWheel={handleWheel}
              >
                {cropMetrics ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="프로필 사진 미리보기"
                    className="absolute max-w-none select-none"
                    draggable={false}
                    src={cropSourceUrl}
                    style={{
                      height: `${cropMetrics.height}px`,
                      left: `${cropMetrics.centeredX + cropOffset.x}px`,
                      top: `${cropMetrics.centeredY + cropOffset.y}px`,
                      width: `${cropMetrics.width}px`,
                    }}
                  />
                ) : null}
                <div
                  className="brand-crop-guide pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    height: `${cropGuideSize}px`,
                    width: `${cropGuideSize}px`,
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold"
                onClick={closeCropper}
                type="button"
              >
                취소
              </button>
              <button
                className="brand-button-primary flex-1 rounded-2xl px-4 py-3 text-sm font-bold"
                disabled={isProcessing || isUploading}
                onClick={handleCropSave}
                type="button"
              >
                {isProcessing || isUploading ? "저장 중..." : "썸네일 적용"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

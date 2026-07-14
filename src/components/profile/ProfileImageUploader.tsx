"use client";

import { ChangeEvent, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProfileImageFromCrop,
  loadImageFromFile,
  type CompressedProfileImage,
  type ProfileImageCrop,
} from "@/lib/profile-image-client";
import { pickSurfAvatarEmoji } from "@/lib/avatar-emoji";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";

export type ProfileImageDraft = CompressedProfileImage;

type CropMetrics = {
  readonly width: number;
  readonly height: number;
  readonly centeredX: number;
  readonly centeredY: number;
};

function calculateCropMetrics(image: HTMLImageElement, zoom: number, frameSize: number): CropMetrics {
  const coverScale = Math.max(
    frameSize / image.naturalWidth,
    frameSize / image.naturalHeight,
  ) * zoom;
  const width = image.naturalWidth * coverScale;
  const height = image.naturalHeight * coverScale;
  return {
    width,
    height,
    centeredX: (frameSize - width) / 2,
    centeredY: (frameSize - height) / 2,
  };
}

function clampCropOffset(metrics: CropMetrics, frameSize: number, offset: { readonly x: number; readonly y: number }) {
  const nextDrawX = Math.min(0, Math.max(frameSize - metrics.width, metrics.centeredX + offset.x));
  const nextDrawY = Math.min(0, Math.max(frameSize - metrics.height, metrics.centeredY + offset.y));
  return {
    x: nextDrawX - metrics.centeredX,
    y: nextDrawY - metrics.centeredY,
  };
}

export function ProfileImageUploader({
  currentImage,
  draftImage,
  editable,
  fallbackSeed,
  onDraftChange,
}: {
  currentImage: string | null;
  draftImage: ProfileImageDraft | null;
  editable: boolean;
  fallbackSeed?: string | null;
  onDraftChange: (draft: ProfileImageDraft) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cropSourceUrl, setCropSourceUrl] = useState<string | null>(null);
  const [cropImage, setCropImage] = useState<HTMLImageElement | null>(null);
  const [cropOriginalBytes, setCropOriginalBytes] = useState(0);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTriggerRef = useRef<HTMLButtonElement>(null);
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
      if (cropSourceUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(cropSourceUrl);
      }
    };
  }, [cropSourceUrl]);

  const previewFrameSize = 260;
  const cropGuideSize = Math.round(previewFrameSize * (88 / 96));
  const cropMetrics = useMemo(() => {
    if (!cropImage) return null;
    return calculateCropMetrics(cropImage, cropZoom, previewFrameSize);
  }, [cropImage, cropZoom]);

  const clampOffset = useCallback((nextX: number, nextY: number) => {
    if (!cropMetrics) return { x: nextX, y: nextY };
    return clampCropOffset(cropMetrics, previewFrameSize, { x: nextX, y: nextY });
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
    window.requestAnimationFrame(() => fileTriggerRef.current?.focus());
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    fileTriggerRef.current?.focus();

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

      onDraftChange(nextCompressed);
      closeCropper();
      setIsProcessing(false);
    } catch (processingError) {
      setError(processingError instanceof Error ? processingError.message : "이미지 처리에 실패했습니다.");
      setIsProcessing(false);
    }
  }

  function handleZoomChange(nextZoom: number) {
    const clampedZoom = clampZoom(nextZoom);
    setCropZoom(clampedZoom);
    if (!cropImage) return;
    const nextMetrics = calculateCropMetrics(cropImage, clampedZoom, previewFrameSize);
    setCropOffset((prev) => clampCropOffset(nextMetrics, previewFrameSize, prev));
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

  const activeImage = draftImage?.previewUrl ?? currentImage;
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

          {editable ? (
            <>
            <button
              aria-label="프로필 사진 변경"
              className={`brand-avatar-action absolute bottom-0 right-0 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-95 ${
                isProcessing ? "pointer-events-none opacity-70" : ""
              }`}
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              ref={fileTriggerRef}
              type="button"
            >
              <Icon className="text-[20px]" name="photo_camera" />
            </button>
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="프로필 사진 파일 선택"
              className="sr-only"
              disabled={isProcessing}
              onChange={handleChange}
              ref={fileInputRef}
              type="file"
            />
            </>
          ) : null}
        </div>

        {draftImage ? <p className="brand-chip-soft mt-2 rounded-full px-3 py-1.5 text-xs font-semibold">저장하기 전 미리보기</p> : null}
        {error ? <p className="brand-chip-danger mt-2 rounded-full px-3 py-1.5 text-xs font-semibold">{error}</p> : null}
      </div>

      <Dialog
        description="사진을 움직이고 확대해 원 안에 보일 영역을 맞춰 주세요."
        onClose={closeCropper}
        open={Boolean(cropImage && cropSourceUrl)}
        title="프로필 사진 다듬기"
      >
        {cropImage && cropSourceUrl ? (
          <>
            <div className="mb-4 flex flex-col items-center gap-4">
              <div
                aria-label="프로필 사진 자르기 영역"
                className="brand-panel-white relative h-[260px] w-[260px] touch-none overflow-hidden rounded-[2rem]"
                onPointerCancel={handlePointerEnd}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onWheel={handleWheel}
                role="group"
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
              <label className="w-full text-sm font-semibold text-[var(--brand-text)]">
                확대
                <input
                  aria-label="프로필 사진 확대"
                  className="mt-2 w-full accent-[var(--brand-primary)]"
                  max="3"
                  min="1"
                  onChange={(event) => handleZoomChange(Number(event.target.value))}
                  step="0.1"
                  type="range"
                  value={cropZoom}
                />
              </label>
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
                disabled={isProcessing}
                onClick={handleCropSave}
                type="button"
              >
                {isProcessing ? "적용 중..." : "썸네일 적용"}
              </button>
            </div>
          </>
        ) : null}
      </Dialog>
    </>
  );
}

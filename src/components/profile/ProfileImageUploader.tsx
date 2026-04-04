"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  compressProfileImageFile,
  type CompressedProfileImage,
  formatBytes,
  percentSaved,
} from "@/lib/profile-image-client";

type ProfileUserPatch = {
  customProfileImageUrl: string | null;
  kakaoProfileImage: string | null;
  profileImage: string | null;
};

export function ProfileImageUploader({
  currentImage,
  currentSource,
  onUpdated,
}: {
  currentImage: string | null;
  currentSource: "custom" | "kakao" | "none";
  onUpdated: (user: ProfileUserPatch) => void;
}) {
  const [compressed, setCompressed] = useState<CompressedProfileImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (compressed?.previewUrl) {
        URL.revokeObjectURL(compressed.previewUrl);
      }
    };
  }, [compressed]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 선택할 수 있습니다.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const nextCompressed = await compressProfileImageFile(file, {
        mimeType: "image/webp",
        quality: 0.78,
        targetSize: 320,
      });

      setCompressed((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return nextCompressed;
      });
    } catch (processingError) {
      setCompressed((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return null;
      });
      setError(processingError instanceof Error ? processingError.message : "이미지 처리에 실패했습니다.");
    } finally {
      setIsProcessing(false);
      event.target.value = "";
    }
  }

  async function handleUpload() {
    if (!compressed) return;

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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "업로드에 실패했습니다.");
      }

      onUpdated(data.user);
      setCompressed((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return null;
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleReset() {
    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch("/api/profile/avatar", {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "기본 사진으로 되돌리기에 실패했습니다.");
      }
      onUpdated(data.user);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "기본 사진으로 되돌리기에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  const previewImage = compressed?.previewUrl ?? currentImage;
  const sourceLabel =
    currentSource === "custom" ? "서비스 프로필 사용 중" : currentSource === "kakao" ? "카카오 프로필 사용 중" : "기본 아바타 사용 중";

  return (
    <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-800">프로필 사진</h3>
          <p className="text-sm text-slate-500 mt-1">브라우저에서 먼저 320px WebP로 줄인 뒤 Vercel Blob에 저장합니다.</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--brand-primary-soft-strong)] px-3 py-1 text-xs font-bold text-[var(--brand-primary-text)]">
          {sourceLabel}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row">
        <div className="flex justify-center sm:block">
          <div className="h-28 w-28 overflow-hidden rounded-full bg-slate-100 ring-4 ring-slate-50">
            {previewImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="프로필 미리보기" className="h-full w-full object-cover" src={previewImage} />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl text-slate-300">👤</div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">새 프로필 사진 선택</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[var(--brand-primary)] file:px-3 file:py-2 file:text-sm file:font-bold file:text-[var(--brand-primary-foreground)]"
              disabled={isProcessing || isUploading}
              onChange={handleChange}
              type="file"
            />
          </label>

          {compressed ? (
            <div className="rounded-xl bg-[var(--brand-primary-soft)] px-4 py-3 text-sm text-slate-700">
              <p>
                {formatBytes(compressed.originalBytes)} → <span className="font-extrabold">{formatBytes(compressed.compressedBytes)}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {compressed.width}x{compressed.height} 원본을 320x320 WebP로 줄여서 {percentSaved(compressed.originalBytes, compressed.compressedBytes)} 절감
              </p>
            </div>
          ) : null}

          {error ? <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                isProcessing || isUploading || !compressed
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "brand-button-primary active:scale-[0.99]"
              }`}
              disabled={isProcessing || isUploading || !compressed}
              onClick={handleUpload}
              type="button"
            >
              {isProcessing ? "압축 중..." : isUploading ? "업로드 중..." : "커스텀 프로필로 저장"}
            </button>

            <button
              className={`rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                isUploading || currentSource !== "custom"
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99]"
              }`}
              disabled={isUploading || currentSource !== "custom"}
              onClick={handleReset}
              type="button"
            >
              카카오 사진으로 되돌리기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

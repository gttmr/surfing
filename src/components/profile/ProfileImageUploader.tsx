"use client";

import { ChangeEvent, useEffect, useState } from "react";
import {
  compressProfileImageFile,
  type CompressedProfileImage,
} from "@/lib/profile-image-client";

type ProfileUserPatch = {
  customProfileImageUrl: string | null;
  kakaoProfileImage: string | null;
  profileImage: string | null;
};

export function ProfileImageUploader({
  currentImage,
  fallbackText,
  onUpdated,
}: {
  currentImage: string | null;
  fallbackText: string;
  onUpdated: (user: ProfileUserPatch) => void;
}) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewImage?.startsWith("blob:")) {
        URL.revokeObjectURL(previewImage);
      }
    };
  }, [previewImage]);

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
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "업로드에 실패했습니다.");
      }

      onUpdated(data.user);
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
      const nextCompressed = await compressProfileImageFile(file, {
        mimeType: "image/webp",
        quality: 0.78,
        targetSize: 320,
      });

      setPreviewImage((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return nextCompressed.previewUrl;
      });
      setIsProcessing(false);
      await uploadCompressed(nextCompressed);
    } catch (processingError) {
      setPreviewImage((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
      setError(processingError instanceof Error ? processingError.message : "이미지 처리에 실패했습니다.");
      setIsProcessing(false);
    }

    event.target.value = "";
  }

  const activeImage = previewImage ?? currentImage;
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-[var(--brand-primary)] bg-[var(--brand-primary)] shadow-[0_18px_40px_var(--brand-shadow)]">
          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="프로필 사진" className="h-full w-full object-cover" src={activeImage} />
          ) : (
            <div className="brand-avatar-shell flex h-full w-full items-center justify-center text-3xl font-extrabold">
              {fallbackText}
            </div>
          )}
        </div>

        <label
          className={`brand-chip-dark absolute bottom-0 right-0 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--brand-surface-elevated)] shadow-lg transition-transform active:scale-95 ${
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

      {error ? <p className="mt-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}

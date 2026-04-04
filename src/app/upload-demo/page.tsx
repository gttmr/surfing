"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { compressProfileImageFile, formatBytes, percentSaved } from "@/lib/profile-image-client";

type ProcessedPreview = {
  compressedBytes: number;
  compressedUrl: string;
  height: number;
  originalBytes: number;
  originalUrl: string;
  quality: number;
  targetSize: number;
  width: number;
};

export default function UploadDemoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(78);
  const [targetSize, setTargetSize] = useState(320);
  const [preview, setPreview] = useState<ProcessedPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const originalUrl = URL.createObjectURL(file);
    let compressedUrl: string | null = null;

    setIsProcessing(true);
    setError(null);

    void (async () => {
      try {
        const processed = await compressProfileImageFile(file, {
          mimeType: "image/webp",
          quality: quality / 100,
          targetSize,
        });
        compressedUrl = processed.previewUrl;

        if (cancelled) return;

        setPreview({
          compressedBytes: processed.compressedBytes,
          compressedUrl: processed.previewUrl,
          height: processed.height,
          originalBytes: processed.originalBytes,
          originalUrl,
          quality,
          targetSize: processed.targetSize,
          width: processed.width,
        });
      } catch (processingError) {
        if (cancelled) return;
        setPreview(null);
        setError(processingError instanceof Error ? processingError.message : "처리 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) {
          setIsProcessing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      URL.revokeObjectURL(originalUrl);
      if (compressedUrl) URL.revokeObjectURL(compressedUrl);
    };
  }, [file, quality, targetSize]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
  }

  const compressedFileName = file ? file.name.replace(/\.[^.]+$/, "") + ".webp" : "profile.webp";

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-4 py-10 text-[#1a1c1c]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <section className="rounded-[32px] bg-[#1a1c1c] px-6 py-8 text-white shadow-[0_20px_60px_rgba(26,28,28,0.12)] sm:px-8">
          <p className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-[#fee500]">
            CLIENT COMPRESS + DIRECT UPLOAD
          </p>
          <h1 className="font-headline text-4xl font-extrabold tracking-[-0.06em] sm:text-5xl">
            프로필 사진은 서버가 아니라 브라우저에서 먼저 줄입니다.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-white/72 sm:text-base">
            이 데모는 사용자가 사진을 고르면 브라우저 안에서 먼저 중앙 정사각형으로 자르고, 320px WebP로 압축한 뒤,
            최종 파일만 업로드하는 흐름을 보여줍니다. 실제 운영에서는 그 다음 단계에서 앱 서버가 받은 presigned URL로 R2/S3에
            직접 PUT 업로드합니다.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-[28px] bg-white p-6 shadow-[0_16px_40px_rgba(26,28,28,0.06)]">
            <h2 className="font-headline text-2xl font-bold tracking-[-0.04em]">실험 설정</h2>
            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#4b4732]">사진 선택</span>
                <input
                  accept="image/*"
                  className="block w-full rounded-2xl border border-[#ddd6b8] bg-[#faf8ec] px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#fee500] file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#201c00]"
                  onChange={handleFileChange}
                  type="file"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#4b4732]">출력 크기</span>
                <select
                  className="w-full rounded-2xl border border-[#ddd6b8] bg-white px-4 py-3 text-sm"
                  onChange={(event) => setTargetSize(Number(event.target.value))}
                  value={targetSize}
                >
                  <option value={256}>256 x 256</option>
                  <option value={320}>320 x 320</option>
                  <option value={512}>512 x 512</option>
                </select>
              </label>

              <label className="block">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#4b4732]">WebP 품질</span>
                  <span className="rounded-full bg-[#fff6bf] px-3 py-1 text-xs font-bold text-[#6a5f00]">{quality}</span>
                </div>
                <input
                  className="w-full accent-[#fee500]"
                  max={90}
                  min={40}
                  onChange={(event) => setQuality(Number(event.target.value))}
                  type="range"
                  value={quality}
                />
              </label>
            </div>

            <div className="mt-8 rounded-[24px] bg-[#fff6bf] p-5 text-sm leading-6 text-[#5d5500]">
              <p className="font-bold text-[#3d3800]">실제 운영 흐름</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5">
                <li>브라우저가 원본을 자르고 줄임</li>
                <li>앱 서버는 업로드 URL만 서명해서 반환</li>
                <li>브라우저가 R2/S3로 직접 업로드</li>
                <li>앱 서버에는 최종 공개 URL만 저장</li>
              </ol>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-[28px] bg-white p-6 shadow-[0_16px_40px_rgba(26,28,28,0.06)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-headline text-2xl font-bold tracking-[-0.04em]">원본</h2>
                  {preview ? (
                    <span className="rounded-full bg-[#f2f2f2] px-3 py-1 text-xs font-bold text-[#4b4732]">
                      {preview.width} x {preview.height}
                    </span>
                  ) : null}
                </div>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[24px] bg-[#f4f4ef]">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="원본 미리보기" className="h-full w-full object-cover" src={preview.originalUrl} />
                  ) : (
                    <p className="px-6 text-center text-sm text-[#4b4732]/55">아직 선택된 이미지가 없습니다.</p>
                  )}
                </div>
                {preview ? (
                  <div className="mt-4 rounded-2xl bg-[#faf8ec] px-4 py-3 text-sm text-[#4b4732]">
                    서버로 그대로 올리면 <span className="font-extrabold">{formatBytes(preview.originalBytes)}</span>가 지나갑니다.
                  </div>
                ) : null}
              </section>

              <section className="rounded-[28px] bg-white p-6 shadow-[0_16px_40px_rgba(26,28,28,0.06)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-headline text-2xl font-bold tracking-[-0.04em]">압축본</h2>
                  {preview ? (
                    <span className="rounded-full bg-[#fee500] px-3 py-1 text-xs font-bold text-[#201c00]">
                      {preview.targetSize} x {preview.targetSize} WEBP
                    </span>
                  ) : null}
                </div>
                <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[24px] bg-[#f4f4ef]">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="압축본 미리보기" className="h-full w-full object-cover" src={preview.compressedUrl} />
                  ) : (
                    <p className="px-6 text-center text-sm text-[#4b4732]/55">압축 결과가 여기에 표시됩니다.</p>
                  )}
                </div>

                {preview ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-[#fff6bf] px-4 py-3 text-sm text-[#5d5500]">
                      업로드되는 실제 파일은 <span className="font-extrabold">{formatBytes(preview.compressedBytes)}</span>입니다.
                      원본 대비 <span className="font-extrabold">{percentSaved(preview.originalBytes, preview.compressedBytes)}</span> 절감됩니다.
                    </div>
                    <a
                      className="inline-flex items-center rounded-2xl bg-[#1a1c1c] px-4 py-3 text-sm font-bold text-white"
                      download={compressedFileName}
                      href={preview.compressedUrl}
                    >
                      압축본 내려받기
                    </a>
                  </div>
                ) : null}
              </section>
            </div>

            <section className="rounded-[28px] bg-white p-6 shadow-[0_16px_40px_rgba(26,28,28,0.06)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-headline text-2xl font-bold tracking-[-0.04em]">왜 서버가 가벼워지나</h2>
                {isProcessing ? (
                  <span className="rounded-full bg-[#fff6bf] px-3 py-1 text-xs font-bold text-[#6a5f00]">브라우저에서 처리 중</span>
                ) : null}
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl bg-[#fff0f0] px-4 py-3 text-sm font-semibold text-[#9b3030]">{error}</div>
              ) : null}

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] bg-[#faf8ec] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#4b4732]/45">App Server</p>
                  <p className="mt-2 font-headline text-3xl font-extrabold tracking-[-0.05em]">
                    {preview ? "0 B" : "-"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#4b4732]/70">
                    업로드 본문은 앱 서버를 통과하지 않습니다. 서버는 presigned URL JSON만 내려줍니다.
                  </p>
                </div>

                <div className="rounded-[24px] bg-[#faf8ec] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#4b4732]/45">Object Storage</p>
                  <p className="mt-2 font-headline text-3xl font-extrabold tracking-[-0.05em]">
                    {preview ? formatBytes(preview.compressedBytes) : "-"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#4b4732]/70">
                    스토리지에는 원본 대신 압축본만 남깁니다. 프로필 사진은 이 크기로 충분합니다.
                  </p>
                </div>

                <div className="rounded-[24px] bg-[#faf8ec] p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#4b4732]/45">Database</p>
                  <p className="mt-2 font-headline text-3xl font-extrabold tracking-[-0.05em]">1 URL</p>
                  <p className="mt-2 text-sm leading-6 text-[#4b4732]/70">
                    DB에는 이미지 바이너리가 아니라 공개 URL 한 줄만 저장합니다.
                  </p>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-[24px] bg-[#1a1c1c] p-5 text-sm text-white">
                <pre className="whitespace-pre-wrap leading-6 text-white/90">{`const compressed = await compressInBrowser(file, {
  targetSize: ${targetSize},
  format: "image/webp",
  quality: ${(quality / 100).toFixed(2)},
});

const signed = await fetch("/api/profile-image/upload-url", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contentType: compressed.type,
    size: compressed.size,
  }),
}).then((response) => response.json());

await fetch(signed.uploadUrl, {
  method: "PUT",
  headers: { "Content-Type": compressed.type },
  body: compressed,
});

await fetch("/api/profile", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    customProfileImageUrl: signed.publicUrl,
  }),
});`}</pre>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

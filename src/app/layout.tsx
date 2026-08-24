import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sdssurfing.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "SDS Surfing",
  title: "SDS Surfing",
  description: "SDS Surfing 모임 참가 신청 및 관리",
  openGraph: {
    title: "SDS Surfing",
    description: "SDS Surfing 모임 참가 신청 및 관리",
    siteName: "SDS Surfing",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SDS Surfing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SDS Surfing",
    description: "SDS Surfing 모임 참가 신청 및 관리",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh bg-brand-page font-sans text-brand-text">
        <div className="brand-mobile-shell mx-auto min-h-dvh w-full max-w-[430px] overflow-x-hidden bg-brand-page">
          {children}
        </div>
      </body>
    </html>
  );
}

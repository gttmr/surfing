import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sds-surfing.web.app";

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

const kakaoJsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background font-sans text-on-surface">
        {children}
        {kakaoJsKey ? (
          <>
            <Script
              src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
              integrity="sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nk"
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
            <Script id="kakao-init" strategy="afterInteractive">
              {`
                window.__KAKAO_INIT__ = function() {
                  if (window.Kakao && !window.Kakao.isInitialized()) {
                    window.Kakao.init(${JSON.stringify(kakaoJsKey)});
                  }
                };
                (function waitForKakao() {
                  if (window.Kakao) {
                    window.__KAKAO_INIT__();
                    return;
                  }
                  window.setTimeout(waitForKakao, 100);
                })();
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}

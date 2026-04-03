import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "동호회 관리",
  description: "동호회 모임 참가 신청 및 관리 사이트",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white">
        {children}
        <script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" integrity="sha384-DKYJZ8NLiK8MN4/C5P2dtSmLQ4KwPaoqAfyA/DfmEc1VDxu4yyC7wy6K1Hs90nk" crossOrigin="anonymous" async />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.__KAKAO_INIT__ = function() {
                if (window.Kakao && !window.Kakao.isInitialized()) {
                  window.Kakao.init("${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}");
                }
              };
              document.addEventListener("DOMContentLoaded", function() {
                var checkKakao = setInterval(function() {
                  if (window.Kakao) { clearInterval(checkKakao); window.__KAKAO_INIT__(); }
                }, 100);
              });
            `,
          }}
        />
      </body>
    </html>
  );
}

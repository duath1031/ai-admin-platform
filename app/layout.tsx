import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/layout/AuthProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI행정사 - 어드미니",
  description: "AI 기반 종합 행정 서비스 플랫폼. 민원 서류 작성, 행정 상담, 서류 검토를 한 곳에서.",
  keywords: ["행정사", "AI", "민원", "서류작성", "행정상담", "인허가"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

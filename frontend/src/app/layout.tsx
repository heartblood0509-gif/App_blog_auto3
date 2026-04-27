import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/layout/header";
import { LicenseGuard } from "@/components/license-guard";
import { MotionProvider } from "@/components/motion-provider";
import { UpdateProgressDialog } from "@/components/update-progress-dialog";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BlogPublisher - 블로그 자동 생성 + 네이버 발행",
  description:
    "레퍼런스 블로그 글의 구조를 분석하고, 동일한 스타일로 새로운 블로그 글을 자동 생성 및 발행합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <MotionProvider>
            <LicenseGuard>
              <div className="min-h-screen bg-background">
                <Header />
                <main>{children}</main>
              </div>
            </LicenseGuard>
          </MotionProvider>
          <Toaster position="bottom-right" richColors />
          <UpdateProgressDialog />
        </ThemeProvider>
      </body>
    </html>
  );
}

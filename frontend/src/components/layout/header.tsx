"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { ApiKeySettings } from "@/components/api-key-settings";
import { PenLine, History, Megaphone, Globe, KeyRound } from "lucide-react";
import { NaverAccountSettings } from "@/components/project/naver-account-settings";
import { Button } from "@/components/ui/button";
import { getLatestVersion } from "@/lib/updates";
import { clearLicenseKey } from "@/lib/license-store";

const SEEN_VERSION_KEY = "blogpick-seen-version";

export function Header() {
  const [hasNewUpdate, setHasNewUpdate] = useState(false);
  const [naverSettingsOpen, setNaverSettingsOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(SEEN_VERSION_KEY);
    const latest = getLatestVersion();
    if (seen !== latest) {
      setHasNewUpdate(true);
    }
  }, []);

  const handleUpdateClick = () => {
    localStorage.setItem(SEEN_VERSION_KEY, getLatestVersion());
    setHasNewUpdate(false);
  };

  const handleLicenseReset = () => {
    if (confirm("라이선스를 해제하시겠습니까? 앱이 재시작됩니다.")) {
      clearLicenseKey();
      window.location.reload();
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2.5 font-extrabold text-xl tracking-tight">
          <PenLine className="h-6 w-6 text-primary" />
          <span>BlogPublisher</span>
        </a>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/updates" />}
            className="relative flex items-center gap-1.5"
            onClick={handleUpdateClick}
          >
            <Megaphone className="h-4 w-4" />
            <span className="hidden sm:inline">새소식</span>
            {hasNewUpdate && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </Button>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/history" />} className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">히스토리</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1.5"
            onClick={() => setNaverSettingsOpen(true)}
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">네이버 계정</span>
          </Button>
          <NaverAccountSettings
            open={naverSettingsOpen}
            onOpenChange={setNaverSettingsOpen}
          />
          <ApiKeySettings />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLicenseReset}
            title="라이선스 해제"
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

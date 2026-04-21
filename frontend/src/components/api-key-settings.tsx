"use client";

import { useState, useEffect } from "react";
import { Key, Eye, EyeOff, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import { getStoredApiKey, setStoredApiKey, removeStoredApiKey } from "@/lib/api-key";
import { appConfig } from "@/config/app-config";

export function ApiKeySettings() {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const stored = getStoredApiKey();
    if (stored) {
      setApiKey(stored);
      setHasKey(true);
    }
  }, []);

  if (!appConfig.isUser) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      toast.error("API 키를 입력해주세요.");
      return;
    }
    setStoredApiKey(trimmed);
    setApiKey(trimmed);
    setHasKey(true);
    toast.success("API 키가 저장되었습니다.");
    setIsOpen(false);
  };

  const handleDelete = () => {
    removeStoredApiKey();
    setApiKey("");
    setHasKey(false);
    setShowKey(false);
    toast.success("API 키가 삭제되었습니다.");
  };

  return (
    <>
      {/* API 키 미설정 시 안내 메시지 */}
      {!hasKey && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors animate-pulse cursor-pointer"
        >
          <Key className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">API 키를 입력해주세요</span>
          <span className="sm:hidden">API 키 필요</span>
        </button>
      )}

      {/* 열쇠 아이콘 버튼 (API 키가 있을 때만 표시) */}
      {hasKey && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 hover:bg-accent hover:text-accent-foreground transition-colors"
          title="API 키 설정"
        >
          <Key className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500" />
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="relative bg-background border rounded-lg shadow-lg w-full max-w-md mx-4 p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">API 키 설정</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  hasKey ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-muted-foreground">
                {hasKey ? "API 키가 저장되어 있습니다" : "API 키가 설정되지 않았습니다"}
              </span>
            </div>

            {/* Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Gemini API Key</label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent transition-colors"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                저장
              </button>
              <button
                onClick={handleDelete}
                disabled={!hasKey}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                삭제
              </button>
            </div>

            {/* Guide */}
            <div className="border rounded-md">
              <button
                onClick={() => setGuideOpen(!guideOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/50 transition-colors rounded-md"
              >
                <span>API 키 발급 방법</span>
                {guideOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {guideOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1.5">1. API 키 발급 (무료)</p>
                      <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 pl-1">
                        <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Google AI Studio</a> 접속 후 구글 로그인</li>
                        <li>&quot;API 키 만들기&quot; 버튼 클릭</li>
                        <li>생성된 키를 복사하여 위 입력란에 붙여넣기</li>
                      </ol>
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-sm font-medium text-foreground mb-1.5">2. 유료 플랜 전환 (선택)</p>
                      <div className="text-xs text-muted-foreground mb-2 space-y-1">
                        <p>블로그, 쓰레드 텍스트 생성은 <strong className="text-foreground">무료 플랜</strong>으로 사용 가능합니다.</p>
                        <p><strong className="text-foreground">쓰레드 이미지 생성</strong>은 유료 기능입니다. Nano Banana 2 모델 사용 (1장당 약 90원, $0.067)</p>
                        <p>이미지 생성을 사용하려면 <strong className="text-foreground">유료 플랜 전환이 필요</strong>합니다.</p>
                      </div>
                      <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 pl-1">
                        <li><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">Google AI Studio</a> 접속</li>
                        <li>좌측 메뉴 &quot;설정&quot; → &quot;결제&quot; 클릭</li>
                        <li>유료 플랜 활성화 후 결제 정보 입력</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Note */}
            <p className="text-xs text-muted-foreground">
              API 키는 브라우저에만 저장되며 서버로 전송되지 않습니다. (요청 시에만 사용)
            </p>
          </div>
        </div>
      )}
    </>
  );
}

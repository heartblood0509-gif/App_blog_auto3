"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PenLine, Loader2, AlertCircle, KeyRound } from "lucide-react";

interface LicenseScreenProps {
  onActivated: () => void;
  errorMessage?: string;
}

export function LicenseScreen({ onActivated, errorMessage }: LicenseScreenProps) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(errorMessage || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    setError("");

    try {
      const { validateLicense, activateMachine } = await import("@/lib/keygen-client");
      const { saveLicenseKey } = await import("@/lib/license-store");

      // 1. 라이선스 검증
      const result = await validateLicense(key.trim());

      if (result.valid) {
        saveLicenseKey(key.trim());
        onActivated();
        return;
      }

      // 2. 기기 등록 필요
      if (result.code === "NEEDS_ACTIVATION") {
        // licenseId를 다시 가져오기 위해 재검증
        const revalidate = await validateLicense(key.trim());
        // validateLicense가 NEEDS_ACTIVATION을 반환하면 licenseId가 없음
        // 직접 활성화 시도
        const activation = await activateMachine(key.trim(), "");
        if (activation.success) {
          saveLicenseKey(key.trim());
          onActivated();
          return;
        }
        setError(activation.message);
        return;
      }

      setError(result.message);
    } catch {
      setError("라이선스 확인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md mx-auto px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <PenLine className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">BlogPublisher</h1>
          <p className="text-sm text-muted-foreground mt-1">
            블로그 자동 생성 + 네이버 자동 발행
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <KeyRound className="h-4 w-4" />
              라이선스 키
            </label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="text-center tracking-widest font-mono"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!key.trim() || loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                확인 중...
              </>
            ) : (
              "활성화"
            )}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-6">
          라이선스 키가 없으신가요? 구매 후 이메일로 발송됩니다.
        </p>
      </div>
    </div>
  );
}

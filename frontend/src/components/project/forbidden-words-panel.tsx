"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import type { ForbiddenCheckResult } from "@/types";
import {
  checkConnection,
  checkForbiddenWords,
  autoReplaceForbidden,
} from "@/lib/publisher-client";

interface ForbiddenWordsPanelProps {
  content: string;
  keywords: string;
  onContentReplace?: (newContent: string) => void;
}

export function ForbiddenWordsPanel({
  content,
  keywords,
  onContentReplace,
}: ForbiddenWordsPanelProps) {
  const [connected, setConnected] = useState(false);
  const [result, setResult] = useState<ForbiddenCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  // 서버 연결 확인
  useEffect(() => {
    checkConnection().then(setConnected);
  }, []);

  // 서버 미연결 시 패널 숨김
  if (!connected) return null;

  const handleCheck = async () => {
    setChecking(true);
    try {
      const r = await checkForbiddenWords(content, keywords);
      setResult(r);
    } catch {
      // 무시
    }
    setChecking(false);
  };

  const handleAutoReplace = async () => {
    try {
      const r = await autoReplaceForbidden(content);
      onContentReplace?.(r.content);
      // 재검사
      const check = await checkForbiddenWords(r.content, keywords);
      setResult(check);
    } catch {
      // 무시
    }
  };

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium">네이버 금칙어 검사</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={checking}
        >
          {checking ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
          )}
          {result ? "재검사" : "검사"}
        </Button>
      </div>

      {result && (
        <>
          {/* 요약 */}
          <div className="flex items-center gap-2">
            {result.has_critical_violations ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : result.forbidden_words.length === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm text-muted-foreground">
              {result.summary}
            </span>
          </div>

          {/* 위반 목록 */}
          {result.forbidden_words.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.forbidden_words.map((w, i) => (
                <Badge
                  key={i}
                  variant={
                    w.category === "replaceable" ? "secondary" : "destructive"
                  }
                >
                  {w.word}
                  {w.suggestion ? ` → ${w.suggestion}` : ""} (L{w.line})
                </Badge>
              ))}
            </div>
          )}

          {/* 키워드 밀도 */}
          {result.keyword_density && (
            <div className="text-xs text-muted-foreground">
              키워드 밀도: {result.keyword_density.density}% (
              {result.keyword_density.count}회) —{" "}
              {result.keyword_density.is_valid ? "적정" : "조정 필요"}
            </div>
          )}

          {/* 자동 대체 버튼 */}
          {result.forbidden_words.some(
            (w) => w.category === "replaceable"
          ) &&
            onContentReplace && (
              <Button variant="outline" size="sm" onClick={handleAutoReplace}>
                대체 가능 단어 자동 대체
              </Button>
            )}
        </>
      )}
    </div>
  );
}

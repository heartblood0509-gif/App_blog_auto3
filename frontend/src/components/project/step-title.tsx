"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Check,
  RefreshCw,
  Loader2,
  PenLine,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { getStoredApiKey } from "@/lib/api-key";
import type { TitleSuggestion } from "@/lib/prompts";

interface StepTitleProps {
  analysisResult: string;
  topic: string;
  keywords: string;
  selectedTitle: string;
  onSelectTitle: (title: string) => void;
}

export function StepTitle({
  analysisResult,
  topic,
  keywords,
  selectedTitle,
  onSelectTitle,
}: StepTitleProps) {
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const storedKey = getStoredApiKey();
      const res = await fetch("/api/suggest-titles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(storedKey && { "x-api-key": storedKey }),
        },
        body: JSON.stringify({ analysisResult, topic, keywords }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "제목 추천에 실패했습니다.");
      }

      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "제목 추천 오류";
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [analysisResult, topic, keywords]);

  // Auto-fetch on mount
  useEffect(() => {
    if (suggestions.length === 0 && !isLoading) {
      fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectSuggestion = (suggestion: TitleSuggestion) => {
    setUseCustom(false);
    setCustomTitle("");
    onSelectTitle(suggestion.title);
  };

  const handleCustomTitleChange = (value: string) => {
    setCustomTitle(value);
    if (value.trim()) {
      setUseCustom(true);
      onSelectTitle(value.trim());
    } else {
      setUseCustom(false);
      if (!suggestions.some((s) => s.title === selectedTitle)) {
        onSelectTitle("");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
          제목 선택
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground">
          AI가 추천한 제목을 선택하거나 직접 입력하세요
        </p>
      </div>

      {/* AI Suggestions */}
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">AI 추천 제목</Label>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-sm"
            onClick={fetchSuggestions}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            다시 추천
          </Button>
        </div>

        {isLoading && suggestions.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        ) : fetchError && suggestions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 rounded-md border border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-base text-destructive font-medium">
              제목 추천에 실패했습니다
            </p>
            <p className="text-sm text-muted-foreground">{fetchError}</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 mt-1"
              onClick={fetchSuggestions}
            >
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {suggestions.map((suggestion, index) => {
              const isSelected =
                !useCustom && selectedTitle === suggestion.title;
              return (
                <Card
                  key={`${suggestion.title}-${index}`}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/30"
                  }`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isSelected ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span
                        className={`text-base ${isSelected ? "font-semibold" : ""}`}
                      >
                        {suggestion.title}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Custom title input */}
        <div className="pt-4 space-y-2">
          <Label
            htmlFor="customTitle"
            className="text-base font-semibold flex items-center gap-2"
          >
            <PenLine className="h-4 w-4" />
            직접 입력
          </Label>
          <Input
            id="customTitle"
            placeholder="원하는 제목을 직접 입력하세요"
            value={customTitle}
            onChange={(e) => handleCustomTitleChange(e.target.value)}
            className={`text-base ${
              useCustom ? "border-primary ring-1 ring-primary/20" : ""
            }`}
          />
          {useCustom && customTitle.trim() && (
            <p className="text-sm text-primary font-medium">
              직접 입력한 제목이 사용됩니다
            </p>
          )}
        </div>

        {selectedTitle && (
          <div className="pt-2 text-base text-center text-green-500 font-semibold">
            제목이 선택되었습니다. 다음 단계로 이동하세요.
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ContentPreview } from "./content-preview";
import { ExportDialog } from "./export-dialog";
import { useStreaming } from "@/hooks/use-streaming";
import { Wand2, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { addHistory } from "@/lib/history";

interface GenerationPanelProps {
  analysisResult: string;
  referenceText: string;
  isAnalysisReady: boolean;
}

export function GenerationPanel({
  analysisResult,
  referenceText,
  isAnalysisReady,
}: GenerationPanelProps) {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [requirements, setRequirements] = useState("");

  const streamingCallbacks = useMemo(
    () => ({
      onComplete: (fullText: string) => {
        toast.success("블로그 글 생성이 완료되었습니다.");
        addHistory({
          type: "blog",
          title: topic.trim(),
          content: fullText,
        });
      },
      onError: (msg: string) => {
        toast.error(msg);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic, keywords, requirements, analysisResult, referenceText]
  );

  const {
    data: generatedContent,
    isStreaming: isGenerating,
    startStream,
    abortStream,
    reset: resetGeneration,
  } = useStreaming(streamingCallbacks);

  const handleGenerate = () => {
    if (!topic.trim()) {
      toast.error("주제를 입력해주세요.");
      return;
    }
    if (!keywords.trim()) {
      toast.error("키워드를 입력해주세요.");
      return;
    }

    startStream("/api/generate", {
      analysisResult,
      referenceText,
      topic: topic.trim(),
      keywords: keywords.trim(),
      requirements: requirements.trim() || undefined,
    });
  };

  const handleReset = () => {
    setTopic("");
    setKeywords("");
    setRequirements("");
    resetGeneration();
  };

  const canGenerate = isAnalysisReady && topic.trim() && keywords.trim();

  return (
    <Card className="border-green-500/20 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-green-500">
            <Wand2 className="h-5 w-5" />
            글 생성
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleReset}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAnalysisReady && (
          <div className="rounded-md bg-muted/50 border border-dashed p-4 text-center text-sm text-muted-foreground">
            먼저 좌측에서 레퍼런스 글을 분석해주세요
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="topic">주제</Label>
            <Input
              id="topic"
              placeholder="예: 2024 여름 스킨케어 루틴"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={!isAnalysisReady || isGenerating}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="keywords">키워드 (쉼표로 구분)</Label>
            <Input
              id="keywords"
              placeholder="예: 자외선 차단제, 수분크림, 여름 피부관리"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={!isAnalysisReady || isGenerating}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="requirements">추가 요구사항 (선택)</Label>
            <Textarea
              id="requirements"
              placeholder="예: 20대 여성 타겟, 친근한 말투, 제품 추천 포함"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="min-h-[80px] resize-y"
              disabled={!isAnalysisReady || isGenerating}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGenerating ? (
            <Button variant="destructive" onClick={abortStream} size="sm">
              생성 중단
            </Button>
          ) : (
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="gap-1.5 bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <Wand2 className="h-3.5 w-3.5" />
              글 생성
            </Button>
          )}
          {isGenerating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI가 블로그 글을 작성하고 있습니다...
            </div>
          )}
          {generatedContent && !isGenerating && (
            <ExportDialog content={generatedContent} title={topic} />
          )}
        </div>

        {(generatedContent || isGenerating) && (
          <>
            <Separator />
            <ContentPreview content={generatedContent} isLoading={isGenerating} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

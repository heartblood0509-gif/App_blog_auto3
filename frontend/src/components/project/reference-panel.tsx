"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CrawlInput } from "./crawl-input";
import { FileUpload } from "./file-upload";
import { AnalysisDisplay } from "./analysis-display";
import { useStreaming } from "@/hooks/use-streaming";
import { BookOpen, Search, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface ReferencePanelProps {
  onAnalysisComplete: (analysisResult: string, referenceText: string) => void;
}

export function ReferencePanel({ onAnalysisComplete }: ReferencePanelProps) {
  const [referenceText, setReferenceText] = useState("");
  const [platform, setPlatform] = useState<string | null>(null);

  const streamingCallbacks = useMemo(
    () => ({
      onComplete: (fullText: string) => {
        onAnalysisComplete(fullText, referenceText);
        toast.success("서사 구조 분석이 완료되었습니다.");
      },
      onError: (msg: string) => {
        toast.error(msg);
      },
    }),
    [onAnalysisComplete, referenceText]
  );

  const {
    data: analysisResult,
    isStreaming: isAnalyzing,
    startStream,
    abortStream,
    reset: resetAnalysis,
  } = useStreaming(streamingCallbacks);

  const handleCrawled = (title: string, content: string, plat: string) => {
    const text = title ? `# ${title}\n\n${content}` : content;
    setReferenceText(text);
    setPlatform(plat);
    toast.success(`${plat} 크롤링 완료`);
  };

  const handleFileLoaded = (content: string, filename: string) => {
    setReferenceText(content);
    setPlatform(null);
    toast.success(`${filename} 파일을 불러왔습니다.`);
  };

  const handleAnalyze = () => {
    if (referenceText.trim().length < 50) {
      toast.error("분석할 텍스트는 최소 50자 이상이어야 합니다.");
      return;
    }
    startStream("/api/analyze", { referenceText: referenceText.trim() });
  };

  const handleReset = () => {
    setReferenceText("");
    setPlatform(null);
    resetAnalysis();
  };

  return (
    <Card className="border-blue-500/20 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-blue-500">
            <BookOpen className="h-5 w-5" />
            레퍼런스 분석
          </CardTitle>
          <div className="flex items-center gap-2">
            {platform && (
              <Badge variant="secondary" className="text-xs">
                {platform}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleReset}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CrawlInput
          onCrawled={handleCrawled}
          onError={(msg) => toast.error(msg)}
          disabled={isAnalyzing}
        />

        <div className="flex items-center gap-2">
          <FileUpload
            onFileLoaded={handleFileLoaded}
            onError={(msg) => toast.error(msg)}
            disabled={isAnalyzing}
          />
          <span className="text-xs text-muted-foreground">
            또는 아래에 직접 텍스트를 붙여넣기
          </span>
        </div>

        <Textarea
          placeholder="레퍼런스 블로그 글을 여기에 붙여넣으세요..."
          value={referenceText}
          onChange={(e) => setReferenceText(e.target.value)}
          className="h-[250px] max-h-[250px] overflow-y-auto resize-none font-mono text-sm"
          disabled={isAnalyzing}
        />
        {referenceText && (
          <div className="text-xs text-muted-foreground">
            {referenceText.replace(/\s/g, "").length.toLocaleString()}자 (공백 제외) / {referenceText.length.toLocaleString()}자 (공백 포함)
          </div>
        )}

        <div className="flex gap-2">
          {isAnalyzing ? (
            <Button variant="destructive" onClick={abortStream} size="sm">
              분석 중단
            </Button>
          ) : (
            <Button
              onClick={handleAnalyze}
              disabled={referenceText.trim().length < 50}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Search className="h-3.5 w-3.5" />
              서사 구조 분석
            </Button>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI가 서사 구조를 분석하고 있습니다...
            </div>
          )}
        </div>

        {(analysisResult || isAnalyzing) && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2 text-blue-500">
                분석 결과
              </h4>
              <AnalysisDisplay content={analysisResult} isLoading={isAnalyzing} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

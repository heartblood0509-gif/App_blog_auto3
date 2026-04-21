"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ContentPreview } from "./content-preview";
import { useStreaming } from "@/hooks/use-streaming";
import { useImageGeneration, type GeneratedImage } from "@/hooks/use-image-generation";
import type { ThreadsSettings } from "./step-threads-settings";
import type { AnalysisMode } from "./step-analysis";
import type { ImageStyle } from "@/lib/prompts";
import { Wand2, Loader2, RotateCcw, ImageIcon, Download, RefreshCw, Camera, Palette, Film, Square } from "lucide-react";
import { toast } from "sonner";
import { addHistory } from "@/lib/history";
import { appConfig } from "@/config/app-config";

interface StepThreadsGenerateProps {
  articleText: string;
  analysisResult: string;
  analysisMode: AnalysisMode;
  settings: ThreadsSettings;
}

export function StepThreadsGenerate({
  articleText,
  analysisResult,
  analysisMode,
  settings,
}: StepThreadsGenerateProps) {
  const isImageMode = analysisMode === "image";

  // Image generation state
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [imageCount, setImageCount] = useState(1);
  const [imageStyle, setImageStyle] = useState<ImageStyle>("realistic");
  const [imagePrompt, setImagePrompt] = useState("");

  const IMAGE_STYLES: { value: ImageStyle; label: string; icon: typeof Camera }[] = [
    { value: "realistic", label: "실사", icon: Camera },
    { value: "illustration", label: "일러스트", icon: Palette },
    { value: "film", label: "감성 필름", icon: Film },
    { value: "minimal", label: "미니멀", icon: Square },
  ];

  const ASPECT_RATIOS = [
    { value: "1:1", label: "1:1" },
    { value: "4:5", label: "4:5 (추천)" },
    { value: "16:9", label: "16:9" },
    { value: "9:16", label: "9:16" },
  ];
  const {
    images: generatedImages,
    isGenerating: isGeneratingImages,
    lastPrompt,
    generate: generateImages,
    reset: resetImages,
  } = useImageGeneration();

  // Extract image analysis section from analysisResult when in image mode
  const imageAnalysisSection = useMemo(() => {
    if (analysisMode !== "image" || !analysisResult) return undefined;
    const imageHeader = analysisResult.indexOf("## 📸 이미지 분석");
    if (imageHeader === -1) return undefined;
    const nextHeader = analysisResult.indexOf("\n## ", imageHeader + 1);
    return nextHeader === -1
      ? analysisResult.slice(imageHeader)
      : analysisResult.slice(imageHeader, nextHeader);
  }, [analysisMode, analysisResult]);

  const streamCallbacks = useMemo(
    () => ({
      onComplete: (fullText: string) => {
        toast.success("쓰레드 생성이 완료되었습니다.");
        const firstLine = fullText.split("\n").find((l) => l.trim())?.replace(/^#+\s*/, "").trim();
        addHistory({
          type: "threads",
          title: firstLine || "쓰레드 게시물",
          content: fullText,
        });
      },
      onError: (msg: string) => {
        toast.error(msg);
      },
    }),
    []
  );

  const {
    data: generatedContent,
    isStreaming: isGenerating,
    startStream,
    abortStream,
    reset,
  } = useStreaming(streamCallbacks);

  const handleGenerate = () => {
    // Reset images when regenerating text
    resetImages();

    if (isImageMode) {
      // Image analysis path: use analysis + topic
      startStream("/api/generate-threads", {
        mode: "analysis",
        analysis: analysisResult,
        topic: settings.topic.trim(),
        requirements: settings.requirements.trim() || undefined,
      });
    } else {
      // Article text path: use raw text
      startStream("/api/generate-threads", {
        mode: "article",
        text: articleText.trim(),
        requirements: settings.requirements.trim() || undefined,
      });
    }
  };

  const handleGenerateImages = () => {
    if (!generatedContent) return;
    generateImages({
      threadsContent: generatedContent,
      imageAnalysis: imageAnalysisSection,
      aspectRatio,
      count: imageCount,
      style: imageStyle,
      customPrompt: imagePrompt.trim() || undefined,
    });
  };

  const handleDownloadImage = (image: GeneratedImage, index: number) => {
    const link = document.createElement("a");
    link.href = `data:${image.mimeType};base64,${image.data}`;
    link.download = `threads-image-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
          쓰레드 생성
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground">
          {isImageMode
            ? "레퍼런스 분석 결과를 바탕으로 쓰레드 게시물을 작성합니다"
            : "뉴스 기사를 분석하여 쓰레드 게시물을 작성합니다"}
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-md border bg-muted/30 p-5 space-y-2 max-w-lg mx-auto">
        <div className="grid grid-cols-[90px_1fr] gap-1.5 text-base">
          <span className="text-muted-foreground">분석 방식</span>
          <span className="font-semibold">
            {isImageMode ? "레퍼런스 분석" : "뉴스 기사 활용"}
          </span>
          {isImageMode && (
            <>
              <span className="text-muted-foreground">주제</span>
              <span className="font-semibold">{settings.topic}</span>
            </>
          )}
          {!isImageMode && (
            <>
              <span className="text-muted-foreground">기사 길이</span>
              <span className="font-semibold">
                {articleText.replace(/\s/g, "").length.toLocaleString()}자 (공백 제외)
              </span>
            </>
          )}
          {settings.requirements && (
            <>
              <span className="text-muted-foreground">요구사항</span>
              <span className="font-semibold truncate">
                {settings.requirements}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Generate controls */}
      <div className="flex items-center justify-center gap-3">
        {!generatedContent && !isGenerating && (
          <Button
            onClick={handleGenerate}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-base px-6 py-2.5"
          >
            <Wand2 className="h-5 w-5" />
            쓰레드 생성
          </Button>
        )}
        {isGenerating && (
          <>
            <Button variant="destructive" onClick={abortStream}>
              생성 중단
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isImageMode
                ? "레퍼런스를 참고하여 쓰레드를 작성하고 있습니다..."
                : "뉴스 기사를 분석하고 쓰레드를 작성하고 있습니다..."}
            </div>
          </>
        )}
        {generatedContent && !isGenerating && (
          <Button variant="outline" onClick={reset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            다시 생성
          </Button>
        )}
      </div>

      {/* Content preview */}
      {(generatedContent || isGenerating) && (
        <>
          <Separator />
          <ContentPreview content={generatedContent} isLoading={isGenerating} />
        </>
      )}

      {/* Image generation section - visible when text generation is complete */}
      {generatedContent && !isGenerating && (
        <>
          <Separator />
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold flex items-center justify-center gap-2 mb-1.5">
                <ImageIcon className="h-5 w-5" />
                이미지 생성
              </h3>
              <p className="text-sm text-muted-foreground">
                쓰레드 내용에 어울리는 이미지를 AI로 생성합니다
              </p>
              {appConfig.isUser && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Nano Banana 2 모델 사용 | 이미지 1장당 약 90원 (유료 플랜 필요)
                </p>
              )}
            </div>

            {/* Settings grid */}
            <div className="space-y-4 max-w-xl mx-auto">
              {/* Style */}
              <div className="space-y-2">
                <span className="text-sm font-semibold">스타일</span>
                <div className="grid grid-cols-4 gap-2">
                  {IMAGE_STYLES.map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={imageStyle === value ? "default" : "outline"}
                      onClick={() => setImageStyle(value)}
                      disabled={isGeneratingImages}
                      className="gap-1.5 h-11 text-sm"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Ratio + Count row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-sm font-semibold">비율</span>
                  <div className="grid grid-cols-2 gap-2">
                    {ASPECT_RATIOS.map(({ value, label }) => (
                      <Button
                        key={value}
                        variant={aspectRatio === value ? "default" : "outline"}
                        onClick={() => setAspectRatio(value)}
                        disabled={isGeneratingImages}
                        className="h-10 text-sm"
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <span className="text-sm font-semibold">매수</span>
                  <div className="grid grid-cols-2 gap-2">
                    {([1, 2] as const).map((count) => (
                      <Button
                        key={count}
                        variant={imageCount === count ? "default" : "outline"}
                        onClick={() => setImageCount(count)}
                        disabled={isGeneratingImages}
                        className="h-10 text-sm"
                      >
                        {count}장
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Image description input */}
              <div className="space-y-2">
                <span className="text-sm font-semibold">이미지 설명 (선택)</span>
                <Textarea
                  placeholder="비워두면 AI가 쓰레드 내용에 맞는 이미지를 자동 생성합니다. 원하는 이미지가 있다면 간단히 설명해주세요. (예: 바다가 보이는 카페에서 커피 마시는 장면)"
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={2}
                  disabled={isGeneratingImages}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Generate button */}
            <div className="flex justify-center">
              {isGeneratingImages ? (
                <div className="flex items-center gap-2 text-base text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  이미지를 생성하고 있습니다... (최대 30초)
                </div>
              ) : (
                <Button
                  onClick={() => {
                    if (generatedImages.length > 0) resetImages();
                    handleGenerateImages();
                  }}
                  className="gap-2 bg-violet-600 hover:bg-violet-700 h-12 px-8 text-base"
                >
                  <ImageIcon className="h-5 w-5" />
                  {generatedImages.length > 0 ? "다시 생성" : "이미지 생성"}
                </Button>
              )}
            </div>

            {/* Image preview grid */}
            {generatedImages.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {generatedImages.map((image, index) => (
                  <div
                    key={index}
                    className="relative group rounded-lg overflow-hidden border bg-muted/30"
                  >
                    <img
                      src={`data:${image.mimeType};base64,${image.data}`}
                      alt={`생성된 이미지 ${index + 1}`}
                      className="w-full h-auto object-contain"
                    />
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1.5 shadow-md"
                        onClick={() => handleDownloadImage(image, index)}
                      >
                        <Download className="h-3.5 w-3.5" />
                        다운로드
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

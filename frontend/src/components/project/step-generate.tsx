"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentPreview } from "./content-preview";
import { ExportDialog } from "./export-dialog";
import { PublishDialog } from "./publish-dialog";
import { useStreaming } from "@/hooks/use-streaming";
import type { GenerationSettings } from "./step-settings";
import {
  Wand2,
  Loader2,
  RotateCcw,
  Youtube,
  Instagram,
  MessageCircle,
  Copy,
  Check,
  SlidersHorizontal,
  Home,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { addHistory, updateHistory } from "@/lib/history";
import { saveImages } from "@/lib/image-store";
import { replaceSectionContent } from "@/lib/sections";
import { SectionEditSheet } from "./section-edit-sheet";
import { BlogImageGenerator, parseImageMarkers } from "./blog-image-generator";
import type { BlogImage } from "./blog-image-generator";
import type { ConvertFormat } from "@/lib/prompts";

interface StepGenerateProps {
  analysisResult: string;
  referenceText: string;
  referenceSource?: string;
  settings: GenerationSettings;
  selectedTitle: string;
  onRestart?: () => void;
  onNewTitle?: () => void;
}

const CONVERT_TABS: {
  id: ConvertFormat;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "youtube-longform",
    label: "유튜브 롱폼",
    icon: <Youtube className="h-4 w-4" />,
  },
  {
    id: "youtube-shortform",
    label: "유튜브 숏폼",
    icon: <Youtube className="h-4 w-4" />,
  },
  {
    id: "instagram",
    label: "인스타그램",
    icon: <Instagram className="h-4 w-4" />,
  },
  {
    id: "threads",
    label: "쓰레드",
    icon: <MessageCircle className="h-4 w-4" />,
  },
];

const CHAR_RANGE_LABELS: Record<string, string> = {
  "500-1500": "500~1,500자",
  "1500-2500": "1,500~2,500자",
  "2500-3500": "2,500~3,500자",
  reference: "레퍼런스 글자수",
};

const countChars = (text: string) =>
  text
    .replace(/\[이미지:[^\]]*\]/g, "")
    .replace(/\s/g, "").length;

export function StepGenerate({
  analysisResult,
  referenceText,
  referenceSource,
  settings,
  selectedTitle,
  onRestart,
  onNewTitle,
}: StepGenerateProps) {
  const [activeConvertTab, setActiveConvertTab] =
    useState<ConvertFormat | null>(null);
  const activeConvertTabRef = useRef<ConvertFormat | null>(null);
  const [convertResults, setConvertResults] = useState<
    Record<string, string>
  >({});
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [resizedContent, setResizedContent] = useState<string | null>(null);
  const [targetCharCount, setTargetCharCount] = useState(0);
  const [editSectionIndex, setEditSectionIndex] = useState<number | null>(null);
  const [editSectionContent, setEditSectionContent] = useState("");
  const [editSectionHeading, setEditSectionHeading] = useState("");
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [regenSheetOpen, setRegenSheetOpen] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [blogImages, setBlogImages] = useState<BlogImage[]>([]);
  const historyIdRef = useRef<string | null>(null);

  // 이미지 변경 시 IndexedDB에도 저장 (ref 사용으로 항상 최신 historyId 참조)
  const handleBlogImagesChange = useCallback((images: BlogImage[]) => {
    setBlogImages(images);
    const hid = historyIdRef.current;
    if (hid && images.length > 0) {
      saveImages(hid, images).catch(() => {});
      updateHistory(hid, { imageCount: images.length });
    }
  }, []);

  // 글 생성 후 자동 금칙어 검증+수정
  const autoFixForbiddenWords = useCallback(async (text: string): Promise<string> => {
    try {
      const { checkConnection, checkForbiddenWords, autoReplaceForbidden } = await import("@/lib/publisher-client");
      const connected = await checkConnection();
      if (!connected) return text;

      const result = await checkForbiddenWords(text, settings.keywords);
      const replaceableCount = result.forbidden_words.filter(w => w.category === "replaceable").length;

      if (replaceableCount > 0) {
        const replaced = await autoReplaceForbidden(text);
        toast.success(`금칙어 ${replaceableCount}개 자동 수정됨 (${result.forbidden_words.filter(w => w.category === "replaceable").map(w => w.word).join(", ")})`);
        return replaced.content;
      }

      if (result.has_critical_violations) {
        toast.warning(`절대 금지어 발견: ${result.forbidden_words.filter(w => w.category !== "replaceable" && w.category !== "cliche").map(w => w.word).join(", ")} — 발행 전 수동 수정이 필요합니다.`);
      }
    } catch {
      // 서버 미연결 시 무시
    }
    return text;
  }, [settings.keywords]);

  const blogStreamCallbacks = useMemo(
    () => ({
      onComplete: async (fullText: string) => {
        // 금칙어 자동 수정
        const fixedText = await autoFixForbiddenWords(fullText);

        toast.success("블로그 글 생성이 완료되었습니다.");
        const id = addHistory({
          type: "blog",
          title: selectedTitle || settings.topic.trim(),
          content: fixedText,
        });
        historyIdRef.current = id;

        // 금칙어 수정된 텍스트로 교체
        if (fixedText !== fullText) {
          setResizedContent(fixedText);
        }
      },
      onError: (msg: string) => {
        toast.error(msg);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, analysisResult, referenceText, selectedTitle]
  );

  const {
    data: generatedContent,
    isStreaming: isGenerating,
    startStream: startBlogStream,
    abortStream: abortBlogStream,
    reset: _resetBlogGeneration,
  } = useStreaming(blogStreamCallbacks);
  void _resetBlogGeneration;

  const convertStreamCallbacks = useMemo(
    () => ({
      onComplete: (fullText: string) => {
        const format = activeConvertTabRef.current;
        if (format) {
          setConvertResults((prev) => ({
            ...prev,
            [format]: fullText,
          }));
        }
        toast.success("콘텐츠 변환이 완료되었습니다.");
      },
      onError: (msg: string) => {
        toast.error(msg);
      },
    }),
    []
  );

  const {
    data: convertingContent,
    isStreaming: isConverting,
    startStream: startConvertStream,
    abortStream: abortConvertStream,
    reset: resetConvert,
  } = useStreaming(convertStreamCallbacks);

  const resizeStreamCallbacks = useMemo(
    () => ({
      onComplete: (fullText: string) => {
        setResizedContent(fullText);
        toast.success("글자수 조절이 완료되었습니다.");
      },
      onError: (msg: string) => {
        toast.error(msg);
      },
    }),
    []
  );

  const {
    data: resizingContent,
    isStreaming: isResizing,
    startStream: startResizeStream,
    abortStream: abortResizeStream,
    reset: resetResize,
  } = useStreaming(resizeStreamCallbacks);

  const editStreamCallbacks = useMemo(
    () => ({
      onComplete: (fullText: string) => {
        if (editSectionIndex !== null) {
          const current = resizedContent || generatedContent;
          if (current) {
            const merged = replaceSectionContent(current, editSectionIndex, fullText);
            setResizedContent(merged);
          }
        }
        setEditSheetOpen(false);
        setEditSectionIndex(null);
        toast.success("구간 수정이 완료되었습니다.");
      },
      onError: (msg: string) => {
        toast.error(msg);
      },
    }),
    [editSectionIndex, resizedContent, generatedContent]
  );

  const {
    data: editStreamData,
    isStreaming: isEditStreaming,
    startStream: startEditStream,
    abortStream: abortEditStream,
    reset: resetEditStream,
  } = useStreaming(editStreamCallbacks);

  // Display content: resized takes priority over original
  const displayContent = resizedContent || generatedContent;
  const currentCharCount = displayContent ? countChars(displayContent) : 0;

  // Preview content changes during resize streaming (edit streaming shows in sheet, not here)
  const previewContent = isResizing ? resizingContent : displayContent;
  const previewLoading = isGenerating || isResizing;

  // Slider range
  const sliderMin = 200;
  const sliderMax = Math.max(
    5000,
    Math.ceil((currentCharCount * 1.5) / 100) * 100
  );

  // Initialize/update target char count when content changes
  useEffect(() => {
    if (currentCharCount > 0 && !isResizing) {
      setTargetCharCount(currentCharCount);
    }
  }, [currentCharCount, isResizing]);

  const handleGenerate = () => {
    startBlogStream("/api/generate", {
      analysisResult,
      referenceText: referenceText || "(내장 템플릿 사용)",
      topic: settings.topic.trim(),
      keywords: settings.keywords.trim(),
      selectedTitle: selectedTitle || undefined,
      persona: settings.persona.trim() || undefined,
      productName: settings.productName.trim() || undefined,
      productAdvantages: settings.productAdvantages.trim() || undefined,
      productLink: settings.productLink.trim() || undefined,
      requirements: settings.requirements.trim() || undefined,
      charCountRange: settings.charCountRange,
      includeImageDesc: settings.includeImageDesc,
    });
  };

  const handleConvert = (format: ConvertFormat) => {
    setActiveConvertTab(format);
    activeConvertTabRef.current = format;
    resetConvert();
    startConvertStream("/api/convert", {
      blogContent: displayContent,
      format,
    });
  };

  const handleCopyConvert = async (format: string) => {
    const text = convertResults[format];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleResize = () => {
    resetResize();
    setConvertResults({});
    startResizeStream("/api/resize", {
      blogContent: displayContent,
      targetCharCount,
      currentCharCount,
    });
  };

  const handleSectionSelect = (index: number, content: string, heading: string) => {
    setEditSectionIndex(index);
    setEditSectionContent(content);
    setEditSectionHeading(heading);
    resetEditStream();
    setEditSheetOpen(true);
  };

  const handleEditSubmit = (instruction: string) => {
    resetEditStream();
    startEditStream("/api/edit-section", {
      fullContent: displayContent,
      sectionContent: editSectionContent,
      sectionIndex: editSectionIndex,
      instruction,
    });
  };

  const handleRegenWithInstruction = (instruction: string) => {
    // 전체 글을 수정 대상으로 설정
    setEditSectionIndex(null);
    resetEditStream();
    setRegenSheetOpen(false);
    setConvertResults({});
    // 전체 글 수정은 resize 스트림 재활용 (결과를 resizedContent에 저장)
    resetResize();
    startResizeStream("/api/edit-section", {
      fullContent: displayContent,
      sectionContent: displayContent,
      sectionIndex: 0,
      instruction,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">글 생성</h2>
        <p className="text-base sm:text-lg text-muted-foreground">
          설정한 내용을 바탕으로 AI가 블로그 글을 작성합니다
        </p>
      </div>

      {/* Summary of settings */}
      <div className="rounded-md border bg-muted/30 p-5 space-y-2 max-w-lg mx-auto">
        <div className="grid grid-cols-[90px_1fr] gap-1.5 text-base">
          {referenceSource && (
            <>
              <span className="text-muted-foreground">레퍼런스</span>
              <span className="font-semibold">{referenceSource}</span>
            </>
          )}
          <span className="text-muted-foreground">제목</span>
          <span className="font-semibold">{selectedTitle}</span>
          <span className="text-muted-foreground">주제</span>
          <span className="font-semibold">{settings.topic}</span>
          <span className="text-muted-foreground">키워드</span>
          <span className="font-semibold">{settings.keywords}</span>
          {settings.persona && (
            <>
              <span className="text-muted-foreground">페르소나</span>
              <span className="font-semibold truncate">{settings.persona}</span>
            </>
          )}
          {settings.productName && (
            <>
              <span className="text-muted-foreground">제품명</span>
              <span className="font-semibold">{settings.productName}</span>
            </>
          )}
          {settings.productAdvantages && (
            <>
              <span className="text-muted-foreground">제품 장점</span>
              <span className="font-semibold truncate">
                {settings.productAdvantages}
              </span>
            </>
          )}
          {settings.productName && (
            <>
              <span className="text-muted-foreground">제품 링크</span>
              <span className="font-semibold truncate">
                {settings.productLink.trim() || "없음 (제품명만 언급)"}
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
          <span className="text-muted-foreground">글자 수</span>
          <span className="font-semibold">
            {CHAR_RANGE_LABELS[settings.charCountRange] ||
              settings.charCountRange}
          </span>
        </div>
      </div>

      {/* Blog generation / resize controls */}
      <div className="flex items-center justify-center gap-3">
        {!generatedContent && !isGenerating && (
          <Button
            onClick={handleGenerate}
            className="gap-2 bg-green-600 hover:bg-green-700 text-base px-6 py-2.5"
          >
            <Wand2 className="h-5 w-5" />
            블로그 글 생성
          </Button>
        )}
        {isGenerating && (
          <>
            <Button variant="destructive" onClick={abortBlogStream}>
              생성 중단
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI가 블로그 글을 작성하고 있습니다...
            </div>
          </>
        )}
        {isResizing && (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={abortResizeStream}
            >
              조절 중단
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              글자수를 조절하고 있습니다...
            </div>
          </>
        )}
        {generatedContent && !isGenerating && !isResizing && (
          <>
            <Button
              variant="outline"
              onClick={() => setRegenSheetOpen(true)}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              다시 생성
            </Button>
            <ExportDialog
              content={displayContent}
              title={settings.topic}
            />
            <Button
              onClick={() => setPublishDialogOpen(true)}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            >
              <Send className="h-3.5 w-3.5" />
              네이버 발행
            </Button>
          </>
        )}
      </div>

      {/* Blog content preview */}
      {(previewContent || isGenerating || isResizing) && (
        <>
          <Separator />
          <ContentPreview
            content={previewContent}
            isLoading={previewLoading}
            editMode={!!displayContent && !isGenerating && !isResizing && !isEditStreaming}
            onSectionSelect={handleSectionSelect}
            blogImages={blogImages}
          />
        </>
      )}

      {/* AI 이미지 생성 — 이미지 마커가 있을 때만 표시 */}
      {displayContent && !isGenerating && !isResizing && parseImageMarkers(displayContent).length > 0 && (
        <>
          <Separator />
          <BlogImageGenerator
            content={displayContent}
            images={blogImages}
            onImagesChange={handleBlogImagesChange}
            title={selectedTitle || settings.topic}
          />
        </>
      )}

      {/* Character count adjustment slider */}
      {displayContent && !isGenerating && !isResizing && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-center flex items-center justify-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              글자수 조절
            </h3>
            <p className="text-sm text-muted-foreground text-center">
              현재{" "}
              <span className="font-semibold text-foreground">
                {currentCharCount.toLocaleString()}자
              </span>{" "}
              (공백 제외)
            </p>

            <div className="max-w-md mx-auto space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-14 text-right shrink-0">
                  {sliderMin.toLocaleString()}자
                </span>
                <input
                  type="range"
                  min={sliderMin}
                  max={sliderMax}
                  step={100}
                  value={targetCharCount}
                  onChange={(e) => setTargetCharCount(Number(e.target.value))}
                  className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-muted accent-green-600 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-600 [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <span className="text-xs text-muted-foreground w-14 shrink-0">
                  {sliderMax.toLocaleString()}자
                </span>
              </div>

              <div className="text-center">
                <span className="text-base font-bold">
                  목표: {targetCharCount.toLocaleString()}자
                </span>
                {targetCharCount !== currentCharCount && (
                  <span
                    className={`ml-2 text-sm font-medium ${
                      targetCharCount > currentCharCount
                        ? "text-blue-500"
                        : "text-orange-500"
                    }`}
                  >
                    ({targetCharCount > currentCharCount ? "+" : ""}
                    {(targetCharCount - currentCharCount).toLocaleString()}자)
                  </span>
                )}
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handleResize}
                  disabled={Math.abs(targetCharCount - currentCharCount) < 100}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  글자수 조절
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Content conversion tabs - only show after blog is generated */}
      {displayContent && !isGenerating && !isResizing && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-center">
              콘텐츠 변환
            </h3>
            <p className="text-base text-muted-foreground text-center">
              생성된 블로그 글을 다른 플랫폼에 맞게 변환합니다
            </p>

            <Tabs
              value={activeConvertTab || ""}
              onValueChange={(v) => {
                const format = v as ConvertFormat;
                if (!convertResults[format] && !isConverting) {
                  handleConvert(format);
                } else {
                  setActiveConvertTab(format);
                }
              }}
            >
              <TabsList className="w-full grid grid-cols-4">
                {CONVERT_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="gap-1.5 text-sm sm:text-base"
                  >
                    {tab.icon}
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {CONVERT_TABS.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-4">
                  {/* Converting state */}
                  {isConverting && activeConvertTab === tab.id && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {tab.label} 대본으로 변환 중...
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={abortConvertStream}
                        >
                          중단
                        </Button>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-4 max-h-[400px] overflow-y-auto">
                        <pre className="text-sm whitespace-pre-wrap font-mono">
                          {convertingContent}
                        </pre>
                        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Result */}
                  {convertResults[tab.id] && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-semibold">
                          {tab.label} 변환 결과
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleCopyConvert(tab.id)}
                          >
                            {copiedFormat === tab.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleConvert(tab.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            다시 변환
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-md border bg-muted/30 p-4 max-h-[400px] overflow-y-auto">
                        <pre className="text-sm whitespace-pre-wrap font-mono">
                          {convertResults[tab.id]}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Not yet converted */}
                  {!convertResults[tab.id] &&
                    !(isConverting && activeConvertTab === tab.id) && (
                      <div className="flex flex-col items-center justify-center py-8 gap-4">
                        <p className="text-base text-muted-foreground">
                          블로그 글을 {tab.label}용으로 변환합니다
                        </p>
                        <Button
                          onClick={() => handleConvert(tab.id)}
                          variant="outline"
                          className="gap-1.5"
                        >
                          {tab.icon}
                          변환하기
                        </Button>
                      </div>
                    )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </>
      )}

      {/* 완료 후 다음 단계 버튼 */}
      {generatedContent && !isGenerating && (
        <>
          <Separator className="my-6" />
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold">다음 단계</h3>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 max-w-md mx-auto">
            {onNewTitle && (
              <Button
                variant="outline"
                onClick={onNewTitle}
                className="gap-2 h-14 px-8 text-base flex-1"
              >
                <RefreshCw className="h-5 w-5" />
                새 제목으로 다시 쓰기
              </Button>
            )}
            {onRestart && (
              <Button
                variant="outline"
                onClick={onRestart}
                className="gap-2 h-14 px-8 text-base flex-1"
              >
                <Home className="h-5 w-5" />
                처음으로
              </Button>
            )}
          </div>
        </>
      )}

      {/* 구간 수정 바텀시트 */}
      <SectionEditSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        sectionHeading={editSectionHeading}
        sectionContent={editSectionContent}
        streamingData={editStreamData}
        isEditing={isEditStreaming}
        onSubmit={handleEditSubmit}
        onAbort={abortEditStream}
      />

      {/* 전체 다시 생성 바텀시트 */}
      <SectionEditSheet
        open={regenSheetOpen}
        onOpenChange={setRegenSheetOpen}
        sectionHeading="전체 글"
        sectionContent={displayContent || ""}
        streamingData=""
        isEditing={false}
        onSubmit={handleRegenWithInstruction}
        onAbort={() => {}}
      />

      {/* 네이버 발행 다이얼로그 */}
      <PublishDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        content={displayContent || ""}
        images={blogImages}
        title={selectedTitle || settings.topic}
        keywords={settings.keywords}
      />
    </div>
  );
}

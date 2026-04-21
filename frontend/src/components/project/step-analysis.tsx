"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CrawlInput } from "./crawl-input";
import { FileUpload } from "./file-upload";
import { AnalysisDisplay } from "./analysis-display";
import { useStreaming } from "@/hooks/use-streaming";
import {
  getAllTemplates,
  saveTemplate,
  deleteTemplate,
  type AnalysisTemplate,
} from "@/lib/templates";
import {
  BookOpen,
  Search,
  Loader2,
  FileText,
  Globe,
  Check,
  ChevronRight,
  Save,
  Trash2,
  ImagePlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

export type AnalysisMode = "template" | "crawl" | "image" | null;

interface UploadedImage {
  data: string; // base64 data URL
  mimeType: string;
}

interface StepAnalysisProps {
  onComplete: (analysisResult: string, referenceText: string, source?: string) => void;
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  contentType?: "blog" | "threads";
}

export function StepAnalysis({ onComplete, mode, onModeChange, contentType = "blog" }: StepAnalysisProps) {
  const isThreads = contentType === "threads";
  const [internalMode, setInternalMode] = useState<AnalysisMode>(mode);
  const templateSelectedRef = useRef(false);

  // 부모 mode 변경 시 내부 동기화 (뒤로가기 등) — 템플릿 선택 직후는 제외
  useEffect(() => {
    if (templateSelectedRef.current) {
      templateSelectedRef.current = false;
      return;
    }
    setInternalMode(mode);
  }, [mode]);

  const setMode = (m: AnalysisMode) => {
    setInternalMode(m);
    onModeChange(m);
  };
  const [referenceText, setReferenceText] = useState("");
  const [platform, setPlatform] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AnalysisTemplate[]>([]);
  const [textConfirmed, setTextConfirmed] = useState(false);

  // Image mode state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Save-as-template dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDescription, setSaveDescription] = useState("");

  useEffect(() => {
    setTemplates(getAllTemplates(contentType));
  }, [contentType]);

  const refreshTemplates = () => {
    setTemplates(getAllTemplates(contentType));
  };

  const {
    data: analysisResult,
    isStreaming: isAnalyzing,
    startStream,
    abortStream,
  } = useStreaming({
    onComplete: (fullText: string) => {
      const source = mode === "image" ? "이미지 분석" : platform ? `${platform} 크롤링` : "직접 입력";
      onComplete(fullText, referenceText, source);
      toast.success(mode === "image" ? "이미지 분석이 완료되었습니다." : "서사 구조 분석이 완료되었습니다.");
    },
    onError: (msg: string) => {
      toast.error(msg);
    },
  });

  // Global paste listener for image mode
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setUploadedImages((prev) => [...prev, { data: base64, mimeType: item.type }]);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (mode !== "image") return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [mode, handlePaste]);

  const handleFileUploadImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUploadedImages((prev) => [...prev, { data: base64, mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageAnalyze = () => {
    if (uploadedImages.length === 0) {
      toast.error("이미지를 1장 이상 업로드해주세요.");
      return;
    }
    startStream("/api/analyze-threads-image", { images: uploadedImages });
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setInternalMode("template"); // 내부 UI는 템플릿 화면 유지
      // 부모 analysisMode 변경 시 내부 동기화 방지
      templateSelectedRef.current = true;
      // 부모 analysisMode는 sourceMode에 따라 설정 (생성 시 올바른 프롬프트 적용)
      if (isThreads && template.sourceMode === "image") {
        onModeChange("image");
      } else {
        onModeChange("template");
      }
      onComplete(template.analysisResult, "", `템플릿: ${template.name}`);
      toast.success(`"${template.name}" 템플릿이 선택되었습니다.`);
    }
  };

  const handleDeleteTemplate = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    deleteTemplate(templateId, contentType);
    refreshTemplates();
    if (selectedTemplate === templateId) {
      setSelectedTemplate(null);
    }
    toast.success("템플릿이 삭제되었습니다.");
  };

  const handleCrawled = (title: string, content: string, plat: string) => {
    const text = title ? `# ${title}\n\n${content}` : content;
    setReferenceText(text);
    setPlatform(plat);
    toast.success(`${plat} 크롤링 완료`);
  };

  const handleAnalyze = () => {
    if (referenceText.trim().length < 50) {
      toast.error("분석할 텍스트는 최소 50자 이상이어야 합니다.");
      return;
    }
    startStream("/api/analyze", { referenceText: referenceText.trim() });
  };

  const handleSaveAsTemplate = () => {
    if (!saveName.trim()) {
      toast.error("템플릿 이름을 입력해주세요.");
      return;
    }
    if (!analysisResult) {
      toast.error("저장할 분석 결과가 없습니다.");
      return;
    }
    saveTemplate({
      name: saveName.trim(),
      description: saveDescription.trim() || "사용자 저장 템플릿",
      analysisResult,
      sourceMode: mode === "image" ? "image" : "crawl",
    }, contentType);
    refreshTemplates();
    setShowSaveDialog(false);
    setSaveName("");
    setSaveDescription("");
    toast.success("분석 결과가 템플릿으로 저장되었습니다.");
  };

  // Mode selection
  if (!internalMode) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">분석 방식을 선택하세요</h2>
          <p className="text-base sm:text-lg text-muted-foreground">
            {isThreads
              ? "템플릿을 활용하거나, 레퍼런스를 직접 분석할 수 있습니다"
              : "저장된 템플릿을 활용하거나, 레퍼런스 글을 직접 분석할 수 있습니다"}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Card
            className="cursor-pointer hover:border-blue-500/50 transition-colors group"
            onClick={() => setMode("template")}
          >
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-5 group-hover:bg-blue-500/20 transition-colors">
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold mb-2">
                {isThreads ? "템플릿 활용" : "템플릿 활용 (추천)"}
              </h3>
              <p className="text-sm text-muted-foreground">
                미리 분석된 스타일을 선택하여 바로 생성합니다
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer hover:border-green-500/50 transition-colors group`}
            onClick={() => setMode(isThreads ? "image" : "crawl")}
          >
            <CardContent className="p-8 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-5 group-hover:bg-green-500/20 transition-colors">
                <Globe className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-lg font-bold mb-2">
                {isThreads ? "레퍼런스 분석" : "레퍼런스 글 분석"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isThreads
                  ? "URL, 텍스트, 이미지 캡처로 레퍼런스를 분석합니다"
                  : "블로그 URL 또는 텍스트로 AI가 분석합니다"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Template selection mode
  if (internalMode === "template") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 mb-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-base"
            onClick={() => {
              setMode(null);
              setSelectedTemplate(null);
            }}
          >
            ← 돌아가기
          </Button>
          <h3 className="text-lg font-bold">템플릿 선택</h3>
        </div>

        <div className="grid gap-3">
          {templates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-base font-medium mb-1">아직 등록된 템플릿이 없습니다</p>
              <p className="text-sm">
                {isThreads
                  ? "레퍼런스 분석 후 템플릿으로 저장할 수 있습니다"
                  : "레퍼런스 글 분석 후 템플릿으로 저장할 수 있습니다"}
              </p>
            </div>
          )}
          {templates.map((template) => {
            const isSelected = selectedTemplate === template.id;
            return (
              <Card
                key={template.id}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-500/5"
                    : "hover:border-blue-500/30"
                }`}
                onClick={() => handleSelectTemplate(template.id)}
              >
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="text-base font-semibold">{template.name}</h4>
                      {template.isBuiltIn && (
                        <Badge variant="outline" className="text-xs">
                          기본
                        </Badge>
                      )}
                      {isSelected && (
                        <Badge className="bg-blue-500 text-white text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          선택됨
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    {!template.isBuiltIn && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteTemplate(e, template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedTemplate && (
          <p className="text-base text-center text-green-500 font-semibold">
            템플릿이 선택되었습니다. 다음 단계로 이동하세요.
          </p>
        )}
      </div>
    );
  }

  // Image analysis mode (threads only)
  if (internalMode === "image") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="sm" className="text-base" onClick={() => { setMode(null); setUploadedImages([]); }}>
            ← 돌아가기
          </Button>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-purple-500" />
            레퍼런스 분석
          </h3>
        </div>

        {/* URL crawling */}
        <CrawlInput onCrawled={handleCrawled} onError={(msg) => toast.error(msg)} />

        {/* File upload */}
        <div className="flex items-center gap-2">
          <FileUpload onFileLoaded={(content) => setReferenceText(content)} onError={(msg) => toast.error(msg)} />
          <span className="text-sm text-muted-foreground">또는 아래에 직접 텍스트를 붙여넣기</span>
        </div>

        {/* Text input */}
        <Textarea
          placeholder="뉴스 기사 또는 레퍼런스 텍스트를 붙여넣으세요..."
          value={referenceText}
          onChange={(e) => { setReferenceText(e.target.value); setTextConfirmed(false); }}
          rows={6}
          disabled={isAnalyzing}
        />
        {referenceText && (
          <div className="text-xs text-muted-foreground">
            {referenceText.replace(/\s/g, "").length.toLocaleString()}자 (공백 제외) / {referenceText.length.toLocaleString()}자 (공백 포함)
          </div>
        )}

        {/* Text confirm button */}
        {referenceText.trim().length >= 50 && !textConfirmed && !analysisResult && (
          <Button
            size="sm"
            onClick={() => { setTextConfirmed(true); onModeChange("crawl"); onComplete(referenceText, referenceText, platform ? `${platform} 크롤링` : "직접 입력"); }}
            className="gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            텍스트 입력 완료
          </Button>
        )}

        {textConfirmed && (
          <p className="text-sm text-center text-green-500 font-semibold">
            텍스트 입력이 완료되었습니다.
          </p>
        )}

        <Separator />

        {/* Image upload area */}
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <ImagePlus className="h-4 w-4 text-purple-500" />
          이미지 캡처 분석
        </h4>
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
          onClick={() => imageInputRef.current?.click()}
        >
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUploadImages}
          />
          <ImagePlus className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium mb-1">
            클릭하여 업로드 또는 Ctrl+V(Cmd+V)로 붙여넣기
          </p>
          <p className="text-xs text-muted-foreground">
            쓰레드 캡처를 여러 장 업로드할 수 있습니다
          </p>
        </div>

        {/* Image previews */}
        {uploadedImages.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {uploadedImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img.data}
                  alt={`업로드 ${idx + 1}`}
                  className="h-32 rounded-md border object-cover"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeImage(idx)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground w-full">
              {uploadedImages.length}장 업로드됨
            </p>
          </div>
        )}

        {/* Analyze button */}
        {uploadedImages.length > 0 && !textConfirmed && (
          <div className="flex gap-2">
            {isAnalyzing ? (
              <>
                <Button variant="destructive" onClick={abortStream} size="sm">
                  분석 중단
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI가 이미지를 분석하고 있습니다...
                </div>
              </>
            ) : (
              <Button
                onClick={handleImageAnalyze}
                disabled={uploadedImages.length === 0}
                className="gap-1.5 bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                <Search className="h-3.5 w-3.5" />
                이미지 분석
              </Button>
            )}
          </div>
        )}

        {/* Analysis result */}
        {(analysisResult || isAnalyzing) && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-base font-semibold text-purple-500">분석 결과</h4>
                {analysisResult && !isAnalyzing && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    onClick={() => setShowSaveDialog(true)}
                  >
                    <Save className="h-3 w-3" />
                    템플릿으로 저장
                  </Button>
                )}
              </div>
              <AnalysisDisplay content={analysisResult} isLoading={isAnalyzing} />
            </div>

            {/* Save as template dialog */}
            {showSaveDialog && (
              <>
                <Separator />
                <div className="space-y-3 rounded-md border p-4 bg-muted/30">
                  <h4 className="text-sm font-medium">템플릿으로 저장</h4>
                  <div className="space-y-2">
                    <Input
                      placeholder="템플릿 이름 (예: 크루즈 여행 쓰레드)"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                    />
                    <Input
                      placeholder="간단한 설명 (선택)"
                      value={saveDescription}
                      onChange={(e) => setSaveDescription(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveAsTemplate}
                      disabled={!saveName.trim()}
                      className="gap-1.5"
                    >
                      <Save className="h-3.5 w-3.5" />
                      저장
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowSaveDialog(false);
                        setSaveName("");
                        setSaveDescription("");
                      }}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </>
            )}

            {analysisResult && !isAnalyzing && (
              <p className="text-base text-center text-green-500 font-semibold">
                이미지 분석이 완료되었습니다. 다음 단계로 이동하세요.
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // Crawl/paste analysis mode
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-3">
        <Button variant="ghost" size="sm" className="text-base" onClick={() => setMode(null)}>
          ← 돌아가기
        </Button>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-green-500" />
          {isThreads ? "뉴스 기사 활용" : "레퍼런스 글 분석"}
        </h3>
        {platform && (
          <Badge variant="secondary">
            {platform}
          </Badge>
        )}
      </div>

      <CrawlInput
        onCrawled={handleCrawled}
        onError={(msg) => toast.error(msg)}
        disabled={isAnalyzing}
      />

      <div className="flex items-center gap-2">
        <FileUpload
          onFileLoaded={(content, filename) => {
            setReferenceText(content);
            setPlatform(null);
            toast.success(`${filename} 파일을 불러왔습니다.`);
          }}
          onError={(msg) => toast.error(msg)}
          disabled={isAnalyzing}
        />
        <span className="text-sm text-muted-foreground">
          또는 아래에 직접 텍스트를 붙여넣기
        </span>
      </div>

      <Textarea
        placeholder={isThreads ? "뉴스 기사 내용을 여기에 붙여넣으세요..." : "레퍼런스 블로그 글을 여기에 붙여넣으세요..."}
        value={referenceText}
        onChange={(e) => setReferenceText(e.target.value)}
        className="h-[200px] max-h-[200px] overflow-y-auto resize-none font-mono text-sm"
        disabled={isAnalyzing}
      />
      {referenceText && (
        <div className="text-xs text-muted-foreground">
          {referenceText.replace(/\s/g, "").length.toLocaleString()}자 (공백
          제외) / {referenceText.length.toLocaleString()}자 (공백 포함)
        </div>
      )}

      <div className="flex gap-2">
        {isThreads ? (
          <Button
            onClick={() => {
              onComplete(referenceText, referenceText, platform ? `${platform} 크롤링` : "직접 입력");
              setTextConfirmed(true);
              toast.success("기사 텍스트가 입력되었습니다.");
            }}
            disabled={referenceText.trim().length < 50 || textConfirmed}
            className="gap-1.5 bg-purple-600 hover:bg-purple-700"
            size="sm"
          >
            <Check className="h-3.5 w-3.5" />
            {textConfirmed ? "입력 완료됨" : "입력 완료"}
          </Button>
        ) : (
          <>
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
          </>
        )}
      </div>

      {isThreads && textConfirmed && (
        <p className="text-base text-center text-green-500 font-semibold">
          기사 입력이 완료되었습니다. 다음 단계로 이동하세요.
        </p>
      )}

      {(analysisResult || isAnalyzing) && mode === "crawl" && !isThreads && (
        <>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-semibold text-blue-500">분석 결과</h4>
              {analysisResult && !isAnalyzing && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => setShowSaveDialog(true)}
                >
                  <Save className="h-3 w-3" />
                  템플릿으로 저장
                </Button>
              )}
            </div>
            <AnalysisDisplay content={analysisResult} isLoading={isAnalyzing} />
          </div>

          {/* Save as template dialog */}
          {showSaveDialog && (
            <>
              <Separator />
              <div className="space-y-3 rounded-md border p-4 bg-muted/30">
                <h4 className="text-sm font-medium">템플릿으로 저장</h4>
                <div className="space-y-2">
                  <Input
                    placeholder="템플릿 이름 (예: 정보성 리뷰형)"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                  />
                  <Input
                    placeholder="간단한 설명 (선택)"
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveAsTemplate}
                    disabled={!saveName.trim()}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    저장
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSaveDialog(false);
                      setSaveName("");
                      setSaveDescription("");
                    }}
                  >
                    취소
                  </Button>
                </div>
              </div>
            </>
          )}

          {analysisResult && !isAnalyzing && (
            <p className="text-base text-center text-green-500 font-semibold">
              분석이 완료되었습니다. 다음 단계로 이동하세요.
            </p>
          )}
        </>
      )}
    </div>
  );
}

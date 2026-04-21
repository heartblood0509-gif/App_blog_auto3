"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ImageIcon,
  Loader2,
  Download,
  DownloadCloud,
  AlertCircle,
  RectangleHorizontal,
  Square,
  Info,
  RotateCcw,
  X,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { getStoredApiKey } from "@/lib/api-key";
import type { BlogImageRatio } from "@/lib/prompts";

export interface BlogImage {
  index: number;
  data: string;
  mimeType: string;
  description: string;
}

interface BlogImageGeneratorProps {
  content: string;
  images: BlogImage[];
  onImagesChange: (images: BlogImage[]) => void;
  title?: string;
}

const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

/** [이미지: 설명] 마커를 파싱하여 설명 목록 반환 */
export function parseImageMarkers(content: string): string[] {
  const regex = /\[이미지:\s*([^\]]+)\]/g;
  const descriptions: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    descriptions.push(match[1].trim());
  }
  return descriptions;
}

export function BlogImageGenerator({
  content,
  images,
  onImagesChange,
  title,
}: BlogImageGeneratorProps) {
  const [ratio, setRatio] = useState<BlogImageRatio>("16:9");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, description: "" });
  const [errors, setErrors] = useState<Record<number, string>>({});
  const abortRef = useRef<AbortController | null>(null);
  // 개별 재생성 상태
  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  const [regenPrompt, setRegenPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const descriptions = parseImageMarkers(content);

  const handleGenerate = useCallback(async () => {
    if (descriptions.length === 0) return;

    setIsGenerating(true);
    setErrors({});
    onImagesChange([]);
    setProgress({ current: 0, total: descriptions.length, description: "" });

    abortRef.current = new AbortController();
    const newImages: BlogImage[] = [];
    const newErrors: Record<number, string> = {};

    try {
      const apiKey = getStoredApiKey();
      const response = await fetch("/api/generate-blog-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { "x-api-key": apiKey }),
        },
        body: JSON.stringify({ descriptions, blogContent: content, ratio }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `오류가 발생했습니다 (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("스트리밍 응답을 읽을 수 없습니다.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === "progress") {
              setProgress({
                current: event.current,
                total: event.total,
                description: event.description,
              });
            } else if (event.type === "image") {
              const img: BlogImage = {
                index: event.index,
                data: event.data,
                mimeType: event.mimeType,
                description: event.description,
              };
              newImages.push(img);
              onImagesChange([...newImages]);
            } else if (event.type === "error") {
              newErrors[event.index] = event.error;
              setErrors({ ...newErrors });
            } else if (event.type === "done") {
              toast.success(`이미지 ${event.total}장 생성 완료`);
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.info("이미지 생성이 중단되었습니다.");
      } else {
        const msg = err instanceof Error ? err.message : "이미지 생성 중 오류";
        toast.error(msg);
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [descriptions, content, ratio, onImagesChange]);

  const handleAbort = () => {
    abortRef.current?.abort();
  };

  const handleRegenerate = useCallback(async (index: number, customPrompt: string) => {
    setIsRegenerating(true);
    try {
      const apiKey = getStoredApiKey();
      const desc = customPrompt.trim() || descriptions[index];
      const response = await fetch("/api/generate-blog-images", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { "x-api-key": apiKey }),
        },
        body: JSON.stringify({
          descriptions: [desc],
          blogContent: content,
          ratio,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "재생성 실패");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("응답을 읽을 수 없습니다.");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "image") {
              const newImg: BlogImage = {
                index,
                data: event.data,
                mimeType: event.mimeType,
                description: desc,
              };
              const updated = images.map((img) =>
                img.index === index ? newImg : img
              );
              onImagesChange(updated);
              toast.success(`${CIRCLE_NUMBERS[index] || index + 1} 이미지가 재생성되었습니다.`);
            } else if (event.type === "error") {
              toast.error(event.error);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "재생성 중 오류";
      toast.error(msg);
    } finally {
      setIsRegenerating(false);
      setRegenIndex(null);
      setRegenPrompt("");
    }
  }, [descriptions, content, ratio, images, onImagesChange]);

  const downloadSingle = (img: BlogImage) => {
    const ext = img.mimeType.includes("png") ? "png" : "jpg";
    const num = CIRCLE_NUMBERS[img.index] || `${img.index + 1}`;
    const safeName = img.description.slice(0, 30).replace(/[/\\?%*:|"<>]/g, "_");
    const filename = `${num}_${safeName}.${ext}`;

    const byteString = atob(img.data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

    const blob = new Blob([ab], { type: img.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAll = async () => {
    if (images.length === 0) return;

    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const baseTitle = (title || "블로그").slice(0, 40).replace(/[/\\?%*:|"<>]/g, "_");

    // 1) 글 텍스트 (번호 마커 포함)
    let textContent = content;
    let idx = 0;
    textContent = textContent.replace(/\[이미지:\s*[^\]]+\]/g, () => {
      const num = CIRCLE_NUMBERS[idx] || `${idx + 1}`;
      idx++;
      return `======= 📷 ${num} 삽입 =======`;
    });
    zip.file(`${baseTitle}.txt`, textContent);

    // 2) 이미지 파일들
    for (const img of images) {
      const ext = img.mimeType.includes("png") ? "png" : "jpg";
      const num = CIRCLE_NUMBERS[img.index] || `${img.index + 1}`;
      const safeName = img.description.slice(0, 30).replace(/[/\\?%*:|"<>]/g, "_");
      const filename = `${num}_${safeName}.${ext}`;

      const byteString = atob(img.data);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

      zip.file(filename, ab);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseTitle}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("글 + 이미지 ZIP 다운로드 완료");
  };

  if (descriptions.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-center flex items-center justify-center gap-2">
        <ImageIcon className="h-5 w-5" />
        AI 이미지 생성
      </h3>

      {/* 비용 안내 */}
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="text-amber-800 dark:text-amber-200">
          <p>본문에서 <strong>{descriptions.length}개</strong>의 이미지 위치를 감지했습니다.</p>
          <p className="mt-1">이미지 1장당 약 <strong>90원</strong>의 API 비용이 발생합니다. (예상 비용: 약 {descriptions.length * 90}원)</p>
        </div>
      </div>

      {/* 비율 선택 + 생성 버튼 */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border p-1">
          <Button
            variant={ratio === "16:9" ? "default" : "ghost"}
            size="sm"
            onClick={() => setRatio("16:9")}
            className="gap-1.5 h-8"
            disabled={isGenerating}
          >
            <RectangleHorizontal className="h-3.5 w-3.5" />
            16:9
          </Button>
          <Button
            variant={ratio === "1:1" ? "default" : "ghost"}
            size="sm"
            onClick={() => setRatio("1:1")}
            className="gap-1.5 h-8"
            disabled={isGenerating}
          >
            <Square className="h-3.5 w-3.5" />
            1:1
          </Button>
        </div>

        {!isGenerating ? (
          <Button
            onClick={handleGenerate}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <ImageIcon className="h-4 w-4" />
            이미지 {descriptions.length}장 생성
          </Button>
        ) : (
          <Button variant="destructive" onClick={handleAbort} className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            생성 중단 ({progress.current}/{progress.total})
          </Button>
        )}
      </div>

      {/* 진행 상태 */}
      {isGenerating && (
        <div className="space-y-2">
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="text-sm text-center text-muted-foreground">
            {CIRCLE_NUMBERS[progress.current - 1] || progress.current} 생성 중: {progress.description}
          </p>
        </div>
      )}

      {/* 생성된 이미지 그리드 */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              생성된 이미지 ({images.length}장)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadAll}
              className="gap-1.5 h-7"
            >
              <DownloadCloud className="h-3.5 w-3.5" />
              글 + 이미지 다운로드 (ZIP)
            </Button>
          </div>

          <div className={`grid gap-3 ${ratio === "1:1" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
            {images.map((img) => {
              const num = CIRCLE_NUMBERS[img.index] || `${img.index + 1}`;
              const isRegenTarget = regenIndex === img.index;

              return (
                <div key={img.index} className="relative group rounded-lg border overflow-hidden bg-muted/30">
                  {/* 번호 뱃지 */}
                  <div className="absolute top-2 left-2 z-10">
                    <Badge className="bg-black/70 text-white hover:bg-black/70 text-xs font-bold">
                      {num}
                    </Badge>
                  </div>
                  {/* 다운로드 + 다시생성 버튼 */}
                  <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7"
                      title="다시 생성"
                      disabled={isRegenerating}
                      onClick={() => {
                        setRegenIndex(isRegenTarget ? null : img.index);
                        setRegenPrompt("");
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7"
                      title="다운로드"
                      onClick={() => downloadSingle(img)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {/* 재생성 중 오버레이 */}
                  {isRegenerating && isRegenTarget && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
                      <div className="flex items-center gap-2 text-white text-sm">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        재생성 중...
                      </div>
                    </div>
                  )}
                  <img
                    src={`data:${img.mimeType};base64,${img.data}`}
                    alt={img.description}
                    className="w-full"
                  />
                  {/* 설명 텍스트 */}
                  <div className="p-2 text-xs text-muted-foreground truncate">
                    {num} {img.description}
                  </div>
                  {/* 다시 생성 프롬프트 입력 패널 */}
                  {isRegenTarget && !isRegenerating && (
                    <div className="p-3 border-t bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{num} 이미지 다시 생성</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => setRegenIndex(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder={`이미지 설명을 직접 입력하세요\n\n예시:\n• 밝은 카페에서 노트북으로 정보를 검색하는 여성의 모습\n• 깨끗한 욕실에서 세안하는 손 클로즈업, 거품과 물방울\n• 나무 테이블 위 스킨케어 제품 플랫레이, 따뜻한 자연광`}
                        value={regenPrompt}
                        onChange={(e) => setRegenPrompt(e.target.value)}
                        className="min-h-[80px] text-sm resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5 flex-1 bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleRegenerate(img.index, regenPrompt)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {regenPrompt.trim() ? "이 내용으로 생성" : "원래 설명으로 재생성"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        비워두면 원래 설명으로 다시 생성합니다. (1장당 약 90원)
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {Object.keys(errors).length > 0 && (
        <div className="space-y-1">
          {Object.entries(errors).map(([idx, err]) => (
            <div key={idx} className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{CIRCLE_NUMBERS[Number(idx)] || Number(idx) + 1} {descriptions[Number(idx)]}: {err}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Eye, Code, PenLine } from "lucide-react";
import { splitIntoSections } from "@/lib/sections";
import type { BlogImage } from "./blog-image-generator";
import type { Components } from "react-markdown";

const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

// LLM이 출력한 리터럴 <br> 태그를 마크다운 빈 줄(문단 분리)로 치환.
// 단일 줄바꿈(\n)은 마크다운 line break(trailing 2 spaces)로 변환하여
// 미리보기에서도 한 줄 한 문장 가독성을 유지.
function sanitizeBeforeRender(text: string): string {
  let result = text.replace(/<br\s*\/?>/gi, "\n\n");
  // 단일 \n을 markdown line break(공백2개 + \n)로 변환
  // 단, 이미 \n\n(빈 줄)이거나 # 제목/[이미지: 마커 앞은 건드리지 않음
  result = result.replace(/([^\n])\n(?!\n)(?!#)(?!\[이미지:)/g, "$1  \n");
  return result;
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl sm:text-3xl font-extrabold mt-2 mb-5 pb-3 border-b leading-tight">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl sm:text-2xl font-bold mt-8 mb-3 leading-snug">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg sm:text-xl font-semibold mt-6 mb-2 leading-snug">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-base leading-relaxed mb-3">{children}</p>
  ),
  li: ({ children }) => (
    <li className="text-base leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  // GFM strikethrough(~~text~~)로 변환된 <del>/<s> 요소의 line-through 스타일을
  // 차단하기 위해 <span>으로 대체. 텍스트 내용은 유지.
  del: ({ children }) => <span style={{ textDecoration: "none" }}>{children}</span>,
  s: ({ children }) => <span style={{ textDecoration: "none" }}>{children}</span>,
  // 마크다운 수평선(---) 은 네이버 변환 단계에서 처리되므로 미리보기에서는 숨김
  hr: () => <div className="my-3" />,
};

interface ContentPreviewProps {
  content: string;
  isLoading: boolean;
  editMode?: boolean;
  onSectionSelect?: (index: number, content: string, heading: string) => void;
  blogImages?: BlogImage[];
}

export function ContentPreview({ content, isLoading, editMode, onSectionSelect, blogImages }: ContentPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");

  // [이미지: ...] 마커에 번호를 붙인 텍스트 생성 (복사용)
  const replaceImageMarkersWithNumbers = (text: string): string => {
    let idx = 0;
    return text.replace(/\[이미지:\s*[^\]]+\]/g, () => {
      const num = CIRCLE_NUMBERS[idx] || `${idx + 1}`;
      idx++;
      return `======= 📷 ${num} 삽입 =======`;
    });
  };

  // 마크다운 → 네이버 블로그용 HTML 변환 (소제목 폰트 크기 + 문단 간격 보존)
  const markdownToNaverHtml = (text: string): string => {
    // LLM이 출력한 리터럴 <br> 태그 제거 (빈 줄로 치환하여 문단 분리 유지)
    const sanitized = sanitizeBeforeRender(text);
    // 이미지가 있으면 마커를 번호로 변환
    const processedText = blogImages && blogImages.length > 0
      ? replaceImageMarkersWithNumbers(sanitized)
      : sanitized;
    const lines = processedText.split("\n");
    const htmlLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // 번호 마커 → 강조 스타일로 변환
      if (/^=+ 📷 .+ 삽입 =+$/.test(trimmed)) {
        htmlLines.push(`<p><br></p><p style="font-size:15px;text-align:center;color:#888"><b>${trimmed}</b></p><p><br></p>`);
        continue;
      }

      // [이미지: ...] → 빈 줄 2개 (사진 공간)
      if (/^\[이미지:[^\]]*\]$/.test(trimmed)) {
        htmlLines.push("<p><br></p><p><br></p>");
        continue;
      }
      // 수평선(----) → 빈 줄 2개 (섹션 구분)
      if (/^-{3,}$/.test(trimmed)) {
        htmlLines.push("<p><br></p><p><br></p>");
        continue;
      }
      // 빈 줄 → 줄바꿈
      if (trimmed === "") {
        htmlLines.push("<p><br></p>");
        continue;
      }
      // H1 제목 → 28px 볼드
      if (/^# /.test(line)) {
        const heading = line.replace(/^# /, "").replace(/\*\*([\s\S]+?)\*\*/g, "$1");
        htmlLines.push(`<p style="font-size:28px"><b>${heading}</b></p><p><br></p>`);
        continue;
      }
      // H2 소제목 → 22px 볼드
      if (/^## /.test(line)) {
        const heading = line.replace(/^## /, "").replace(/\*\*([\s\S]+?)\*\*/g, "$1");
        htmlLines.push(`<p><br></p><p style="font-size:22px"><b>${heading}</b></p><p><br></p>`);
        continue;
      }
      // H3 소소제목 → 19px 볼드
      if (/^### /.test(line)) {
        const heading = line.replace(/^### /, "").replace(/\*\*([\s\S]+?)\*\*/g, "$1");
        htmlLines.push(`<p style="font-size:19px"><b>${heading}</b></p>`);
        continue;
      }
      // 일반 텍스트 → 15px + 볼드/이탤릭 처리 + 링크 텍스트만
      const processed = trimmed
        .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "<b><i>$1</i></b>")
        .replace(/\*\*([\s\S]+?)\*\*/g, "<b>$1</b>")
        .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<i>$1</i>")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^[-*+]\s+/, "")
        .replace(/^\d+\.\s+/, "");
      htmlLines.push(`<p style="font-size:15px">${processed}</p>`);
    }

    return htmlLines.join("");
  };

  const handleCopy = async () => {
    const html = markdownToNaverHtml(content);
    // 이미지가 있으면 plain text에도 번호 마커 적용
    const copyPlainText = blogImages && blogImages.length > 0
      ? replaceImageMarkersWithNumbers(plainText.trim())
      : plainText.trim();
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([copyPlainText], { type: "text/plain" }),
        }),
      ]);
    } catch {
      await navigator.clipboard.writeText(copyPlainText);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 마크다운 → 순수 텍스트 변환 (글자수 카운트용)
  const stripMarkdown = (text: string): string =>
    text
      .replace(/\[이미지:[^\]]*\]/g, "")
      .replace(/^-{3,}$/gm, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "$1")
      .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/~~([\s\S]+?)~~/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n{3,}/g, "\n\n");

  const plainText = content ? stripMarkdown(content) : "";
  const textWithoutImageTags = plainText.replace(/\[이미지:[^\]]*\]/g, "");
  const charCountWithSpaces = textWithoutImageTags.length;
  const charCountNoSpaces = textWithoutImageTags.replace(/\s/g, "").length;

  if (isLoading && !content) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
        생성된 콘텐츠가 여기에 표시됩니다
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "preview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("preview")}
            className="h-7 px-2 text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            미리보기
          </Button>
          <Button
            variant={viewMode === "raw" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("raw")}
            className="h-7 px-2 text-xs"
          >
            <Code className="h-3 w-3 mr-1" />
            마크다운
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {charCountNoSpaces.toLocaleString()}자 (공백 제외) / {charCountWithSpaces.toLocaleString()}자 (공백 포함)
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[500px] rounded-md border bg-muted/30 p-5">
        {viewMode === "preview" ? (
          (() => {
            // 이미지 마커를 인라인 이미지 또는 번호 플레이스홀더로 렌더링하는 함수
            const imageMap = new Map<number, BlogImage>();
            blogImages?.forEach((img) => imageMap.set(img.index, img));

            // 전체 content에서 각 마커의 글로벌 인덱스를 미리 계산
            const globalImageIndices = new Map<string, number>();
            let globalIdx = 0;
            const allMarkers = content.match(/\[이미지:\s*[^\]]+\]/g) || [];
            // 각 마커의 위치(offset)별로 글로벌 인덱스 부여
            let searchFrom = 0;
            for (const marker of allMarkers) {
              const pos = content.indexOf(marker, searchFrom);
              globalImageIndices.set(`${pos}`, globalIdx++);
              searchFrom = pos + marker.length;
            }

            const renderContentWithImages = (md: string) => {
              // [이미지: 설명] 마커를 기준으로 분할
              const parts = md.split(/(\[이미지:\s*[^\]]+\])/g);

              // 이 섹션의 첫 마커가 content 전체에서 몇 번째인지 계산
              let markerCountBefore = 0;
              const sectionStart = content.indexOf(md);
              if (sectionStart > 0) {
                const textBefore = content.slice(0, sectionStart);
                markerCountBefore = (textBefore.match(/\[이미지:\s*[^\]]+\]/g) || []).length;
              }
              let localImgIdx = 0;

              return parts.map((part, i) => {
                const match = part.match(/^\[이미지:\s*([^\]]+)\]$/);
                if (match) {
                  const currentIdx = markerCountBefore + localImgIdx++;
                  const img = imageMap.get(currentIdx);
                  const num = CIRCLE_NUMBERS[currentIdx] || `${currentIdx + 1}`;

                  if (img) {
                    return (
                      <div key={`img-${i}`} className="my-4 relative">
                        <div className="absolute top-2 left-2 z-10">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-black/70 text-white text-xs font-bold">
                            {num}
                          </span>
                        </div>
                        <img
                          src={`data:${img.mimeType};base64,${img.data}`}
                          alt={match[1].trim()}
                          className="w-full rounded-lg"
                        />
                      </div>
                    );
                  }

                  // 이미지 미생성 → 플레이스홀더
                  return (
                    <div
                      key={`ph-${i}`}
                      className="my-4 flex items-center justify-center gap-2 py-6 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground text-sm"
                    >
                      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted-foreground/20 text-xs font-bold">
                        {num}
                      </span>
                      <span>[이미지: {match[1].trim()}]</span>
                    </div>
                  );
                }

                if (!part.trim()) return null;
                return (
                  <ReactMarkdown
                    key={`md-${i}`}
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {sanitizeBeforeRender(part)}
                  </ReactMarkdown>
                );
              });
            };

            return editMode && onSectionSelect ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {splitIntoSections(content).map((section) => (
                  <div
                    key={section.index}
                    className="relative group rounded-lg px-2 -mx-2 py-1 transition-all cursor-pointer hover:bg-green-500/5 hover:ring-2 hover:ring-green-500/30"
                    onClick={() =>
                      onSectionSelect(
                        section.index,
                        section.content,
                        section.heading
                      )
                    }
                  >
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Badge
                        variant="outline"
                        className="gap-1 text-xs bg-background border-green-500/50 text-green-600"
                      >
                        <PenLine className="h-3 w-3" />
                        수정
                      </Badge>
                    </div>
                    {blogImages && blogImages.length > 0
                      ? renderContentWithImages(section.content)
                      : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {sanitizeBeforeRender(section.content)}
                        </ReactMarkdown>
                      )
                    }
                  </div>
                ))}
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {blogImages && blogImages.length > 0
                  ? renderContentWithImages(content)
                  : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {sanitizeBeforeRender(content)}
                    </ReactMarkdown>
                  )
                }
              </div>
            );
          })()
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-mono">{content}</pre>
        )}
        {isLoading && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
        )}
      </ScrollArea>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wand2, Loader2 } from "lucide-react";

const PRESETS = [
  { label: "더 친근하게", text: "더 친근하고 부드러운 말투로 변경해줘" },
  { label: "더 자세하게", text: "더 구체적이고 자세하게 설명해줘" },
  { label: "더 간결하게", text: "핵심만 남기고 간결하게 줄여줘" },
  { label: "전문적으로", text: "더 전문적이고 신뢰감 있는 톤으로 변경해줘" },
];

interface SectionEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionHeading: string;
  sectionContent: string;
  streamingData: string;
  isEditing: boolean;
  onSubmit: (instruction: string) => void;
  onAbort: () => void;
}

export function SectionEditSheet({
  open,
  onOpenChange,
  sectionHeading,
  sectionContent,
  streamingData,
  isEditing,
  onSubmit,
  onAbort,
}: SectionEditSheetProps) {
  const [instruction, setInstruction] = useState("");

  const handleSubmit = () => {
    const text = instruction.trim();
    if (!text) return;
    onSubmit(text);
  };

  const handlePreset = (presetText: string) => {
    setInstruction(presetText);
    onSubmit(presetText);
  };

  const handleClose = () => {
    if (isEditing) {
      onAbort();
    }
    setInstruction("");
    onOpenChange(false);
  };

  // 섹션 미리보기: 3줄로 축약
  const previewLines = sectionContent
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, 3);
  const previewText =
    previewLines.join("\n") +
    (sectionContent.split("\n").filter((l) => l.trim()).length > 3
      ? "\n..."
      : "");

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-0 pt-0 pb-0 max-h-[85vh]"
      >
        <div className="max-w-lg mx-auto w-full px-5 pt-5 pb-6 space-y-4">
          {/* 헤더 */}
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg font-bold truncate">
              {sectionHeading === "전체 글" ? "전체 글 다시 생성" : `구간 수정: ${sectionHeading}`}
            </SheetTitle>
          </SheetHeader>

          {/* 스트리밍 중 — 실시간 미리보기 */}
          {isEditing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                수정 중...
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 max-h-[300px] overflow-y-auto">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {streamingData}
                </pre>
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={onAbort}
                className="w-full"
              >
                중단
              </Button>
            </div>
          ) : (
            <>
              {/* 선택된 구간 미리보기 */}
              <div className="rounded-lg border bg-muted/30 p-3 max-h-[100px] overflow-y-auto">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {previewText}
                </pre>
              </div>

              {/* 빠른 프리셋 */}
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePreset(preset.text)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium border bg-white dark:bg-white/10 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* 커스텀 지시 입력 + 버튼 */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="어떻게 수정할까요?"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  className="min-h-[44px] max-h-[80px] resize-none text-base flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
                <Button
                  onClick={handleSubmit}
                  disabled={!instruction.trim()}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 shrink-0 h-auto"
                >
                  <Wand2 className="h-4 w-4" />
                  수정
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileCode, FileType } from "lucide-react";

interface ExportDialogProps {
  content: string;
  title?: string;
  disabled?: boolean;
}

type ExportFormat = "txt" | "md" | "html";

export function ExportDialog({ content, title, disabled }: ExportDialogProps) {
  const [open, setOpen] = useState(false);

  const handleExport = (format: ExportFormat) => {
    let blob: Blob;
    let filename: string;
    const baseTitle = title || "blog-post";

    switch (format) {
      case "txt":
        blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        filename = `${baseTitle}.txt`;
        break;
      case "md":
        blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
        filename = `${baseTitle}.md`;
        break;
      case "html": {
        const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${baseTitle}</title>
  <style>
    body { font-family: 'Pretendard', -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.8; color: #333; }
    h1 { font-size: 1.8rem; margin-bottom: 1rem; }
    h2 { font-size: 1.4rem; margin-top: 2rem; }
    h3 { font-size: 1.2rem; margin-top: 1.5rem; }
    p { margin: 0.8rem 0; }
    blockquote { border-left: 3px solid #ddd; padding-left: 1rem; margin-left: 0; color: #666; }
    ul, ol { padding-left: 1.5rem; }
  </style>
</head>
<body>
${markdownToHtml(content)}
</body>
</html>`;
        blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
        filename = `${baseTitle}.html`;
        break;
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" disabled={disabled} className="gap-1.5" />}
      >
        <Download className="h-3.5 w-3.5" />
        내보내기
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>파일 내보내기</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          <Button
            variant="outline"
            className="justify-start gap-3 h-12"
            onClick={() => handleExport("txt")}
          >
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">텍스트 파일</div>
              <div className="text-xs text-muted-foreground">.txt</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-3 h-12"
            onClick={() => handleExport("md")}
          >
            <FileCode className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">마크다운</div>
              <div className="text-xs text-muted-foreground">.md</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-3 h-12"
            onClick={() => handleExport("html")}
          >
            <FileType className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">HTML</div>
              <div className="text-xs text-muted-foreground">.html (스타일 포함)</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(.+)$/gm, (match) => {
      if (
        match.startsWith("<h") ||
        match.startsWith("<li") ||
        match.startsWith("<blockquote") ||
        match.startsWith("</p>")
      )
        return match;
      return match;
    })
    .replace(/^(?!<[hblou/])/gm, "<p>")
    .replace(/<p><\/p>/g, "");
}

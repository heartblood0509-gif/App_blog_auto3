"use client";

import { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getHistory,
  deleteHistory,
  clearHistory,
  type HistoryItem,
} from "@/lib/history";
import { getImages, deleteImages } from "@/lib/image-store";
import type { BlogImage } from "@/components/project/blog-image-generator";
import {
  History,
  Search,
  Trash2,
  FileText,
  ChevronDown,
  ImageIcon,
  Download,
} from "lucide-react";

const CIRCLE_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedImages, setExpandedImages] = useState<Record<string, BlogImage[]>>({});

  useEffect(() => {
    setItems(getHistory());
  }, []);

  // 펼쳤을 때 해당 항목의 이미지를 IndexedDB에서 로드
  useEffect(() => {
    if (!expandedId || expandedImages[expandedId]) return;
    getImages(expandedId).then((imgs) => {
      if (imgs.length > 0) {
        setExpandedImages((prev) => ({ ...prev, [expandedId]: imgs }));
      }
    }).catch(() => {});
  }, [expandedId, expandedImages]);

  const handleDelete = (id: string) => {
    if (!confirm("이 항목을 삭제하시겠습니까?")) return;
    deleteHistory(id);
    deleteImages(id).catch(() => {});
    setItems(getHistory());
    setExpandedImages((prev) => { const n = { ...prev }; delete n[id]; return n; });
    if (expandedId === id) setExpandedId(null);
  };

  const handleClearAll = () => {
    if (!confirm("모든 히스토리를 삭제하시겠습니까?")) return;
    // IndexedDB에서도 모두 삭제
    items.forEach((item) => deleteImages(item.id).catch(() => {}));
    clearHistory();
    setItems([]);
    setExpandedImages({});
    setExpandedId(null);
  };

  const handleDownloadImage = (img: BlogImage) => {
    const ext = img.mimeType.includes("png") ? "png" : "jpg";
    const num = CIRCLE_NUMBERS[img.index] || `${img.index + 1}`;
    const safeName = img.description.slice(0, 30).replace(/[/\\?%*:|"<>]/g, "_");
    const byteString = atob(img.data);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: img.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${num}_${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q)
    );
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <m.div
      className="container mx-auto px-4 py-6 max-w-4xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="h-6 w-6" />
          히스토리
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{items.length}개</Badge>
          {items.length > 0 && (
            <m.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAll}
                className="gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                전체 삭제
              </Button>
            </m.div>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="제목, 내용으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {items.length === 0 && (
        <m.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="shadow-lg border-border/50">
            <CardContent className="p-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">
                아직 저장된 히스토리가 없습니다
              </p>
              <p className="text-sm mt-1">
                블로그 글이나 쓰레드를 생성하면 자동으로 저장됩니다
              </p>
            </CardContent>
          </Card>
        </m.div>
      )}

      {items.length > 0 && filteredItems.length === 0 && (
        <Card className="shadow-lg border-border/50">
          <CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">검색 결과가 없습니다</p>
            <p className="text-sm mt-1">다른 검색어를 시도해보세요</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <AnimatePresence>
          {filteredItems.map((item, i) => {
            const isExpanded = expandedId === item.id;
            return (
              <m.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="shadow-lg border-border/50 hover:shadow-xl transition-shadow">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between">
                      <div
                        className="space-y-1 flex-1 min-w-0 cursor-pointer"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : item.id)
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              item.type === "blog" ? "default" : "secondary"
                            }
                          >
                            {item.type === "blog" ? "블로그" : "쓰레드"}
                          </Badge>
                          {item.imageCount && item.imageCount > 0 && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <ImageIcon className="h-3 w-3" />
                              {item.imageCount}장
                            </Badge>
                          )}
                          <CardTitle className="text-base truncate">
                            {item.title}
                          </CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : item.id)
                          }
                        >
                          <m.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </m.div>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <AnimatePresence mode="wait">
                      {!isExpanded && (
                        <m.p
                          key="preview"
                          className="text-sm text-muted-foreground line-clamp-2 mb-2"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {item.content.slice(0, 100)}
                        </m.p>
                      )}
                      {isExpanded && (
                        <m.div
                          key="full"
                          className="mt-2 space-y-3"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="rounded-md border bg-muted/30 p-4 max-h-[500px] overflow-y-auto">
                            <pre className="text-sm whitespace-pre-wrap font-sans">
                              {item.content}
                            </pre>
                          </div>
                          {/* 이미지 그리드 */}
                          {expandedImages[item.id] && expandedImages[item.id].length > 0 && (
                            <div className="space-y-2">
                              <span className="text-xs font-semibold flex items-center gap-1.5">
                                <ImageIcon className="h-3.5 w-3.5" />
                                생성된 이미지 ({expandedImages[item.id].length}장)
                              </span>
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {expandedImages[item.id].map((img) => (
                                  <div
                                    key={img.index}
                                    className="relative group rounded-md border overflow-hidden cursor-pointer"
                                    onClick={() => handleDownloadImage(img)}
                                  >
                                    <img
                                      src={`data:${img.mimeType};base64,${img.data}`}
                                      alt={img.description}
                                      className="w-full"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                      <Download className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="absolute top-1 left-1">
                                      <Badge className="bg-black/70 text-white hover:bg-black/70 text-[10px] h-5 px-1.5">
                                        {CIRCLE_NUMBERS[img.index] || img.index + 1}
                                      </Badge>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </m.div>
                      )}
                    </AnimatePresence>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(item.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </m.div>
  );
}

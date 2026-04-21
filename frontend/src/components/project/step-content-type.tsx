"use client";

import { m } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { PenLine, MessageCircle } from "lucide-react";

export type ContentType = "blog" | "threads";

interface StepContentTypeProps {
  selected: ContentType | null;
  onSelect: (type: ContentType) => void;
}

export function StepContentType({ selected, onSelect }: StepContentTypeProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
          콘텐츠 유형 선택
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground">
          어떤 콘텐츠를 만들고 싶으신가요?
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 max-w-lg mx-auto">
        <m.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Card
            className={`cursor-pointer transition-all group ${
              selected === "blog"
                ? "border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20"
                : "hover:border-blue-500/50"
            }`}
            onClick={() => onSelect("blog")}
          >
            <CardContent className="p-8 text-center">
              <m.div
                className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-5 group-hover:bg-blue-500/20 transition-colors"
                animate={selected === "blog" ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                <PenLine className="h-8 w-8 text-blue-500" />
              </m.div>
              <h3 className="text-lg font-bold mb-2">블로그 포스팅</h3>
              <p className="text-sm text-muted-foreground">
                레퍼런스 분석 기반 SEO 최적화 블로그 글 작성
              </p>
            </CardContent>
          </Card>
        </m.div>

        <m.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Card
            className={`cursor-pointer transition-all group ${
              selected === "threads"
                ? "border-purple-500 bg-purple-500/5 ring-2 ring-purple-500/20"
                : "hover:border-purple-500/50"
            }`}
            onClick={() => onSelect("threads")}
          >
            <CardContent className="p-8 text-center">
              <m.div
                className="mx-auto w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-5 group-hover:bg-purple-500/20 transition-colors"
                animate={selected === "threads" ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.4 }}
              >
                <MessageCircle className="h-8 w-8 text-purple-500" />
              </m.div>
              <h3 className="text-lg font-bold mb-2">쓰레드</h3>
              <p className="text-sm text-muted-foreground">
                레퍼런스 분석 기반 쓰레드 게시물 작성
              </p>
            </CardContent>
          </Card>
        </m.div>
      </div>

      <AnimatePresenceWrapper selected={selected} />
    </div>
  );
}

function AnimatePresenceWrapper({ selected }: { selected: ContentType | null }) {
  if (!selected) return null;
  return (
    <m.p
      className="text-base text-center text-green-500 font-semibold"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {selected === "blog" ? "블로그 포스팅" : "쓰레드"}이 선택되었습니다.
      다음 단계로 이동하세요.
    </m.p>
  );
}

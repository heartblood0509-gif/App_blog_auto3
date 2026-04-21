"use client";

import { UPDATES } from "@/lib/updates";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UpdatesPage() {
  return (
    <main className="container mx-auto max-w-2xl px-4 py-8 space-y-8">
      {/* 헤더 */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/" />}
          className="gap-1.5 -ml-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          돌아가기
        </Button>
        <h1 className="text-3xl font-extrabold">업데이트 내역</h1>
        <p className="text-muted-foreground">
          Blog Pick의 새로운 기능과 개선 사항을 확인하세요
        </p>
      </div>

      {/* 업데이트 목록 */}
      <div className="space-y-10">
        {UPDATES.map((update, i) => (
          <article key={update.version} className="space-y-5">
            {/* 버전 헤더 */}
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={`text-sm font-bold px-2.5 py-0.5 ${
                  i === 0
                    ? "border-green-500 text-green-600 bg-green-500/10"
                    : ""
                }`}
              >
                {update.version}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {update.date}
              </span>
              {i === 0 && (
                <Badge className="bg-green-600 text-white text-xs">
                  최신
                </Badge>
              )}
            </div>
            <h2 className="text-xl font-bold">{update.title}</h2>

            {/* 섹션 */}
            <div className="space-y-6">
              {update.sections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span>{section.emoji}</span>
                    {section.title}
                  </h3>

                  <div className="space-y-4 pl-1">
                    {section.items.map((item, j) => (
                      <div key={j} className="space-y-1.5">
                        {item.label && (
                          <p className="text-base font-medium">
                            {item.label}
                          </p>
                        )}
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {item.details.map((detail, k) => (
                            <li
                              key={k}
                              className="flex items-start gap-2"
                            >
                              <span className="text-muted-foreground/60 mt-0.5 shrink-0">
                                •
                              </span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 구분선 (마지막 항목 제외) */}
            {i < UPDATES.length - 1 && (
              <div className="border-t pt-2" />
            )}
          </article>
        ))}
      </div>
    </main>
  );
}

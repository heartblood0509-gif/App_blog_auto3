"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  StepContentType,
  type ContentType,
} from "@/components/project/step-content-type";
import {
  StepAnalysis,
  type AnalysisMode,
} from "@/components/project/step-analysis";
import {
  StepSettings,
  type GenerationSettings,
} from "@/components/project/step-settings";
import { StepTitle } from "@/components/project/step-title";
import { StepGenerate } from "@/components/project/step-generate";
import {
  StepThreadsSettings,
  type ThreadsSettings,
} from "@/components/project/step-threads-settings";
import { StepThreadsGenerate } from "@/components/project/step-threads-generate";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

const BLOG_STEPS = [
  { label: "콘텐츠 유형", description: "블로그 또는 쓰레드 선택" },
  { label: "분석 방식", description: "템플릿 활용 또는 레퍼런스 글 분석" },
  { label: "글 설정", description: "주제, 키워드, 글자수 설정" },
  { label: "제목 선택", description: "AI 추천 제목 선택" },
  { label: "생성 & 변환", description: "블로그 글 생성 + 콘텐츠 변환" },
];

const THREADS_STEPS = [
  { label: "콘텐츠 유형", description: "블로그 또는 쓰레드 선택" },
  { label: "분석 방식", description: "템플릿 활용 또는 레퍼런스 분석" },
  { label: "글 설정", description: "추가 요구사항 설정" },
  { label: "쓰레드 생성", description: "설정 기반 쓰레드 작성" },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<number>(1);
  const contentRef = useRef<HTMLDivElement>(null);

  // Content type
  const [contentType, setContentType] = useState<ContentType | null>(null);

  // Blog states
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>(null);
  const [analysisResult, setAnalysisResult] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [referenceSource, setReferenceSource] = useState("");
  const [selectedTitle, setSelectedTitle] = useState("");
  const [settings, setSettings] = useState<GenerationSettings>({
    topic: "",
    keywords: "",
    persona: "",
    productName: "",
    productAdvantages: "",
    productLink: "",
    requirements: "",
    charCountRange: "reference",
    includeImageDesc: true,
  });

  // Threads states
  const [threadsSettings, setThreadsSettings] = useState<ThreadsSettings>({
    topic: "",
    requirements: "",
  });

  const steps = contentType === "threads" ? THREADS_STEPS : BLOG_STEPS;

  const handleAnalysisComplete = useCallback(
    (analysis: string, refText: string, source?: string) => {
      setAnalysisResult(analysis);
      setReferenceText(refText);
      if (source) setReferenceSource(source);
      // 템플릿 선택 시 (refText가 비어있음) 자동으로 다음 스텝 이동
      if (analysis && !refText) {
        setTimeout(() => {
          setDirection(1);
          setCurrentStep(2);
        }, 400);
      }
    },
    []
  );

  const canGoNext = () => {
    if (currentStep === 0) return contentType !== null;

    if (contentType === "blog") {
      if (currentStep === 1) return !!analysisResult;
      if (currentStep === 2)
        return (
          settings.topic.trim() !== "" && settings.keywords.trim() !== ""
        );
      if (currentStep === 3) return selectedTitle.trim() !== "";
      return false;
    }

    if (contentType === "threads") {
      if (currentStep === 1) return !!analysisResult;
      if (currentStep === 2) {
        if (analysisMode === "image") return threadsSettings.topic.trim() !== "";
        return true;
      }
      return false;
    }

    return false;
  };

  const goToStep = (next: number, dir: "forward" | "backward") => {
    setDirection(dir === "forward" ? 1 : -1);
    setCurrentStep(next);
  };

  // Reset scroll on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  const handleBack = () => {
    if (currentStep === 0) return;
    if (currentStep === 1 && analysisMode !== null) {
      setAnalysisMode(null);
      return;
    }
    goToStep(currentStep - 1, "backward");
  };

  const renderStep = () => {
    if (currentStep === 0) {
      return (
        <StepContentType
          selected={contentType}
          onSelect={(type) => {
            setContentType(type);
            setTimeout(() => goToStep(1, "forward"), 300);
          }}
        />
      );
    }

    if (contentType === "blog") {
      switch (currentStep) {
        case 1:
          return (
            <StepAnalysis
              onComplete={handleAnalysisComplete}
              mode={analysisMode}
              onModeChange={setAnalysisMode}
            />
          );
        case 2:
          return (
            <StepSettings settings={settings} onChange={setSettings} />
          );
        case 3:
          return (
            <StepTitle
              analysisResult={analysisResult}
              topic={settings.topic}
              keywords={settings.keywords}
              selectedTitle={selectedTitle}
              onSelectTitle={(title) => {
                setSelectedTitle(title);
                if (title.trim()) {
                  setTimeout(() => goToStep(4, "forward"), 400);
                }
              }}
            />
          );
        case 4:
          return (
            <StepGenerate
              analysisResult={analysisResult}
              referenceText={referenceText}
              referenceSource={referenceSource}
              settings={settings}
              selectedTitle={selectedTitle}
              onNewTitle={() => {
                setSelectedTitle("");
                goToStep(3, "backward");
              }}
              onRestart={() => {
                setCurrentStep(0);
                setContentType(null);
                setAnalysisMode(null);
                setAnalysisResult("");
                setReferenceText("");
                setSelectedTitle("");
                setSettings({
                  topic: "",
                  keywords: "",
                  persona: "",
                  productName: "",
                  productAdvantages: "",
                  productLink: "",
                  requirements: "",
                  charCountRange: "reference",
                  includeImageDesc: true,
                });
              }}
            />
          );
      }
    }

    if (contentType === "threads") {
      switch (currentStep) {
        case 1:
          return (
            <StepAnalysis
              onComplete={handleAnalysisComplete}
              mode={analysisMode}
              onModeChange={setAnalysisMode}
              contentType="threads"
            />
          );
        case 2:
          return (
            <StepThreadsSettings
              settings={threadsSettings}
              onChange={setThreadsSettings}
              analysisMode={analysisMode}
            />
          );
        case 3:
          return (
            <StepThreadsGenerate
              articleText={referenceText}
              analysisResult={analysisResult}
              analysisMode={analysisMode}
              settings={threadsSettings}
            />
          );
      }
    }

    return null;
  };

  const progressPercentage = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Stepper indicator */}
      <div className="mb-10">
        {/* Progress bar */}
        <div className="relative h-1.5 bg-muted rounded-full overflow-hidden mb-8">
          <m.div
            className="absolute top-0 left-0 h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>

        {/* Step circles - uniform grid */}
        <div
          className="grid items-start"
          style={{ gridTemplateColumns: `repeat(${steps.length * 2 - 1}, auto)` }}
        >
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            return (
              <div
                key={`${step.label}-${index}`}
                className="contents"
              >
                {/* Step circle + label */}
                <div className="flex flex-col items-center">
                  <m.div
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-colors duration-300 ${
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : "bg-muted text-muted-foreground"
                    }`}
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.08 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    {isCompleted ? (
                      <m.div
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                      </m.div>
                    ) : (
                      index + 1
                    )}
                  </m.div>
                  <div className="mt-2 text-center max-w-[100px] sm:max-w-[130px]">
                    <p
                      className={`text-xs sm:text-sm font-bold transition-colors duration-300 ${
                        isCurrent
                          ? "text-foreground"
                          : isCompleted
                            ? "text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block mt-1">
                      {step.description}
                    </p>
                  </div>
                </div>
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="flex items-center self-start pt-5 sm:pt-[22px] px-1 sm:px-2">
                    <div className="w-12 sm:w-20 h-0.5 bg-muted rounded-full overflow-hidden">
                      <m.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: "0%" }}
                        animate={{
                          width: index < currentStep ? "100%" : "0%",
                        }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content with animation */}
      <Card className="shadow-lg border-border/50">
        <CardContent className="p-6 sm:p-10 overflow-hidden">
          <div ref={contentRef} className="relative min-h-[200px]">
            <AnimatePresence mode="wait" custom={direction}>
              <m.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                {renderStep()}
              </m.div>
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8">
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: currentStep > 0 ? 1 : 0.4 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="gap-2 text-base px-5 py-2.5"
          >
            <ChevronLeft className="h-5 w-5" />
            이전
          </Button>
        </m.div>

        <span className="text-base font-medium text-muted-foreground">
          {currentStep + 1} / {steps.length}
        </span>

        {currentStep < steps.length - 1 ? (
          <m.div
            whileHover={canGoNext() ? { scale: 1.03 } : {}}
            whileTap={canGoNext() ? { scale: 0.97 } : {}}
          >
            <Button
              onClick={() => goToStep(currentStep + 1, "forward")}
              disabled={!canGoNext()}
              className="gap-2 text-base px-5 py-2.5"
            >
              다음
              <ChevronRight className="h-5 w-5" />
            </Button>
          </m.div>
        ) : (
          <div className="w-[100px]" />
        )}
      </div>
    </div>
  );
}

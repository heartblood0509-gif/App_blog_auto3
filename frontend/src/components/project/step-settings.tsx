"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  getAllPresets,
  savePreset,
  deletePreset,
  type ProductPreset,
} from "@/lib/product-presets";
import { Save, Trash2, ChevronDown, HelpCircle, X } from "lucide-react";
import { toast } from "sonner";

function Guide({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        data-guide-trigger
        className={`inline-flex items-center justify-center h-5 w-5 rounded-full transition-colors ${
          open
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }`}
        aria-label="도움말"
      >
        {open ? <X className="h-3 w-3" /> : <HelpCircle className="h-4 w-4" />}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50 p-4 text-sm leading-relaxed space-y-2" data-guide>
          {children}
        </div>
      )}
    </>
  );
}

export type CharCountRange =
  | "500-1500"
  | "1500-2500"
  | "2500-3500"
  | "reference";

export interface GenerationSettings {
  topic: string;
  keywords: string;
  persona: string;
  productName: string;
  productAdvantages: string;
  productLink: string;
  requirements: string;
  charCountRange: CharCountRange;
  includeImageDesc: boolean;
}

interface StepSettingsProps {
  settings: GenerationSettings;
  onChange: (settings: GenerationSettings) => void;
}

const CHAR_COUNT_OPTIONS: {
  value: CharCountRange;
  label: string;
  desc: string;
  recommended?: boolean;
}[] = [
  { value: "500-1500", label: "500~1,500자", desc: "짧고 간결한 글" },
  {
    value: "1500-2500",
    label: "1,500~2,500자",
    desc: "블로그 상위노출 최적 분량",
  },
  { value: "2500-3500", label: "2,500~3,500자", desc: "더 깊이있는 긴 글" },
  {
    value: "reference",
    label: "레퍼런스 글자수 그대로",
    desc: "분석 결과의 글자수를 따름",
    recommended: true,
  },
];

const PERSONA_PRESETS = [
  { label: "20대 여성", text: "20대 중반 여성, 뷰티·스킨케어에 관심 많은 직장인" },
  { label: "30대 직장인 남성", text: "30대 초반 남성 직장인, 실용적인 정보를 중시" },
  { label: "30대 워킹맘", text: "30대 후반 워킹맘, 육아와 일을 병행하며 효율을 중시" },
  { label: "40~50대 주부", text: "40대 후반 주부, 건강과 가족 돌봄에 관심" },
  { label: "대학생", text: "20대 초반 대학생, 가성비를 중시하는 알뜰 소비자" },
  { label: "자영업자", text: "40대 자영업자, 사업 경험이 풍부하고 현실적인 조언을 중시" },
  { label: "전문가/의사", text: "해당 분야 10년차 전문가, 권위 있고 신뢰감 있는 어조" },
];

const REQUIREMENT_SUGGESTIONS = [
  // 말투/톤
  { label: "친근한 말투", text: "친근한 말투로 작성" },
  { label: "전문적인 톤", text: "전문적이고 신뢰감 있는 톤으로 작성" },
  { label: "~요 체", text: "~요 체로 작성" },
  { label: "~다 체", text: "~다 체로 작성" },
  // 콘텐츠 스타일
  { label: "경험담 위주", text: "개인 경험담 위주로 작성" },
  { label: "비교 리뷰", text: "다른 제품과 비교하는 리뷰 형식으로 작성" },
  { label: "리스트형 구성", text: "리스트형(번호 매기기)으로 구성" },
  { label: "전후 비교 포함", text: "사용 전후 비교 내용 포함" },
  // 포함 요소
  { label: "가격 정보 포함", text: "가격 정보를 포함" },
  { label: "단점도 언급", text: "장점뿐 아니라 단점도 솔직하게 언급" },
  { label: "계절감 반영", text: "현재 계절에 맞는 내용으로 작성" },
  { label: "오프닝에 결론 먼저", text: "오프닝에서 결론/결과를 먼저 보여주고 시작" },
];

export function StepSettings({ settings, onChange }: StepSettingsProps) {
  const [presets, setPresets] = useState<ProductPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [showPresetList, setShowPresetList] = useState(false);
  const [guideOpen, setGuideOpen] = useState<"product" | "topic" | "persona" | "requirements" | null>(null);
  const presetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPresets(getAllPresets());
  }, []);

  // 바깥 클릭 시 드롭다운/가이드 닫기
  useEffect(() => {
    if (!showPresetList && !guideOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showPresetList &&
        presetRef.current &&
        !presetRef.current.contains(e.target as Node)
      ) {
        setShowPresetList(false);
      }
      if (guideOpen) {
        const target = e.target as HTMLElement;
        const clickedGuide = target.closest("[data-guide]") || target.closest("[data-guide-trigger]");
        if (!clickedGuide) {
          setGuideOpen(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPresetList, guideOpen]);

  const update = (key: keyof GenerationSettings, value: string) => {
    onChange({ ...settings, [key]: value });
  };

  const handleSelectPreset = (preset: ProductPreset) => {
    setSelectedPresetId(preset.id);
    setShowPresetList(false);
    onChange({
      ...settings,
      topic: preset.topic,
      productName: preset.productName,
      productAdvantages: preset.productAdvantages,
      productLink: preset.productLink,
    });
    toast.success(`"${preset.productName}" 제품 정보를 불러왔습니다.`);
  };

  const handleSavePreset = () => {
    if (!settings.productName.trim()) {
      toast.error("제품명을 입력해야 저장할 수 있습니다.");
      return;
    }
    savePreset({
      productName: settings.productName.trim(),
      productAdvantages: settings.productAdvantages.trim(),
      productLink: settings.productLink.trim(),
      topic: settings.topic.trim(),
    });
    setPresets(getAllPresets());
    toast.success(
      `"${settings.productName}" 제품 정보가 저장되었습니다.`
    );
  };

  const handleDeletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deletePreset(id);
    setPresets(getAllPresets());
    if (selectedPresetId === id) setSelectedPresetId(null);
    toast.success("제품 정보가 삭제되었습니다.");
  };

  const handleClearPreset = () => {
    setSelectedPresetId(null);
    onChange({
      ...settings,
      topic: "",
      productName: "",
      productAdvantages: "",
      productLink: "",
    });
  };

  const selectedPreset = presets.find((p) => p.id === selectedPresetId);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">글 설정</h2>
        <p className="text-base sm:text-lg text-muted-foreground">
          생성할 블로그 글의 주제와 키워드 등을 입력하세요
        </p>
      </div>

      <div className="grid gap-6 max-w-lg mx-auto">
        {/* Product preset selector */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-base font-semibold">저장된 제품 정보</Label>
            <Guide
              open={guideOpen === "product"}
              onToggle={() =>
                setGuideOpen(guideOpen === "product" ? null : "product")
              }
            >
              <p className="font-semibold text-blue-700 dark:text-blue-300">
                제품 정보란?
              </p>
              <p className="text-muted-foreground">
                홍보하고 싶은 제품이 있을 때 사용합니다.
                제품명, 장점, 구매 링크를 입력하면 블로그 글 <strong>후반부에 자연스럽게</strong> 녹여서 생성해줍니다.
              </p>
              <p className="font-semibold text-blue-700 dark:text-blue-300 pt-1">
                어떻게 활용하나요?
              </p>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li>제품 없이 순수 정보성 글만 쓸 때는 <strong>비워두면 됩니다</strong></li>
                <li>자주 쓰는 제품은 &quot;현재 제품 정보 저장&quot;으로 저장해두면 다음에 한 번에 불러올 수 있습니다</li>
                <li>제품 링크를 넣으면 글 하단에 구매 링크가 포함되고, 비우면 제품명만 언급됩니다</li>
              </ul>
              <div className="pt-1 px-3 py-2 bg-white/60 dark:bg-white/5 rounded-md text-muted-foreground">
                <span className="font-medium">예시:</span> 제품명 &quot;아이오페 레티놀 세럼&quot; + 장점 &quot;민감성 피부에도 자극 없음&quot; 입력 → 글 후반부에 &quot;요즘 쓰고 있는 아이오페 레티놀 세럼이 민감한 제 피부에도...&quot; 식으로 자연스럽게 반영
              </div>
            </Guide>
          </div>
          <div className="relative" ref={presetRef}>
            <button
              type="button"
              onClick={() => setShowPresetList(!showPresetList)}
              className="w-full flex items-center justify-between rounded-md border p-3 text-base text-left hover:border-muted-foreground/30 transition-colors"
            >
              <span
                className={
                  selectedPreset
                    ? "font-semibold"
                    : "text-muted-foreground"
                }
              >
                {selectedPreset
                  ? selectedPreset.productName
                  : "제품을 선택하세요"}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${showPresetList ? "rotate-180" : ""}`}
              />
            </button>

            {showPresetList && (
              <div className="absolute z-10 w-full mt-1 rounded-md border bg-background shadow-lg max-h-[200px] overflow-y-auto">
                {presets.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    저장된 제품이 없습니다
                  </div>
                ) : (
                  presets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedPresetId === preset.id ? "bg-primary/5" : ""
                      }`}
                      onClick={() => handleSelectPreset(preset)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold truncate">
                          {preset.productName}
                        </p>
                        {preset.topic && (
                          <p className="text-sm text-muted-foreground truncate">
                            주제: {preset.topic}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeletePreset(e, preset.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
                {selectedPreset && (
                  <div
                    className="p-3 text-sm text-center text-muted-foreground cursor-pointer hover:bg-muted/50 border-t"
                    onClick={() => {
                      handleClearPreset();
                      setShowPresetList(false);
                    }}
                  >
                    선택 해제
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-sm"
              onClick={handleSavePreset}
              disabled={!settings.productName.trim()}
            >
              <Save className="h-3.5 w-3.5" />
              현재 제품 정보 저장
            </Button>
          </div>
        </div>

        {/* Topic */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="topic" className="text-base font-semibold">
              주제 <span className="text-destructive">*</span>
            </Label>
            <Guide
              open={guideOpen === "topic"}
              onToggle={() =>
                setGuideOpen(guideOpen === "topic" ? null : "topic")
              }
            >
              <p className="font-semibold text-blue-700 dark:text-blue-300">
                주제란?
              </p>
              <p className="text-muted-foreground">
                AI가 글을 쓸 <strong>핵심 소재</strong>입니다.
                앞서 분석한 레퍼런스 글의 &quot;서사 구조&quot;는 그대로 따르되, 주제만 바꿔서 새로운 글을 생성합니다.
              </p>
              <p className="font-semibold text-blue-700 dark:text-blue-300 pt-1">
                잘 쓰는 팁
              </p>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li><strong>구체적일수록 좋습니다</strong> — &quot;스킨케어&quot;보다 &quot;여름 자외선 차단제 고르는 법&quot;</li>
                <li>네이버 검색에 실제로 사람들이 검색할 만한 표현을 사용하세요</li>
                <li>레퍼런스 글과 <strong>같은 카테고리</strong>의 주제를 넣으면 더 자연스러운 결과가 나옵니다</li>
              </ul>
              <div className="pt-1 px-3 py-2 bg-white/60 dark:bg-white/5 rounded-md text-muted-foreground">
                <p className="font-medium pb-1">좋은 예시 vs 나쁜 예시</p>
                <p>&#10004; &quot;30대 직장인 아침 스킨케어 루틴 추천&quot;</p>
                <p>&#10004; &quot;강아지 산책 후 발 씻기는 방법&quot;</p>
                <p className="text-muted-foreground/60">&#10008; &quot;스킨케어&quot; (너무 광범위)</p>
                <p className="text-muted-foreground/60">&#10008; &quot;좋은 글 써줘&quot; (주제가 아님)</p>
              </div>
            </Guide>
          </div>
          <Input
            id="topic"
            placeholder="예: 2024 여름 스킨케어 루틴"
            value={settings.topic}
            onChange={(e) => update("topic", e.target.value)}
            className="text-base"
          />
          <p className="text-sm text-muted-foreground">
            블로그 글의 메인 주제를 입력하세요
          </p>
        </div>

        {/* Keywords */}
        <div className="space-y-2">
          <Label htmlFor="keywords" className="text-base font-semibold">
            노출 키워드 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="keywords"
            placeholder="예: 자외선 차단제, 수분크림, 여름 피부관리"
            value={settings.keywords}
            onChange={(e) => update("keywords", e.target.value)}
            className="text-base"
          />
          <p className="text-sm text-muted-foreground">
            SEO에 포함할 키워드를 쉼표로 구분하여 입력하세요
          </p>
        </div>

        {/* Persona */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="persona" className="text-base font-semibold">
              글쓴이 페르소나
            </Label>
            <Guide
              open={guideOpen === "persona"}
              onToggle={() =>
                setGuideOpen(guideOpen === "persona" ? null : "persona")
              }
            >
              <p className="font-semibold text-blue-700 dark:text-blue-300">
                페르소나란?
              </p>
              <p className="text-muted-foreground">
                &quot;이 글을 쓴 사람이 누구인가&quot;를 설정합니다.
                AI가 이 사람의 <strong>시선, 경험, 말투, 공감 포인트</strong>로 글 전체를 일관되게 작성합니다.
              </p>
              <p className="font-semibold text-blue-700 dark:text-blue-300 pt-1">
                구체적일수록 좋아요
              </p>
              <ul className="text-muted-foreground list-disc pl-4 space-y-1">
                <li><strong>나이 + 성별 + 직업</strong>이 기본입니다</li>
                <li>고민 기간, 경험 수준을 추가하면 더 자연스럽습니다</li>
                <li>비워두면 주제에 맞게 AI가 자동으로 판단합니다</li>
              </ul>
              <div className="pt-1 px-3 py-2 bg-white/60 dark:bg-white/5 rounded-md text-muted-foreground">
                <p className="font-medium pb-1">좋은 예시</p>
                <p>&#10004; &quot;32살 여성 직장인, 홍조 고민 5년차, 민감성 건성 피부&quot;</p>
                <p>&#10004; &quot;28살 남성, 헬스 3년차, 보충제에 관심 많음&quot;</p>
                <p>&#10004; &quot;45살 주부, 아이 둘 엄마, 가성비 육아템 전문&quot;</p>
                <p className="text-muted-foreground/60 pt-1">&#10008; &quot;여자&quot; (너무 막연함)</p>
              </div>
            </Guide>
          </div>
          <Input
            id="persona"
            placeholder="예: 32살 여성 직장인, 홍조 고민 5년차, 민감성 건성 피부"
            value={settings.persona}
            onChange={(e) => update("persona", e.target.value)}
            className="text-base"
          />
          <div className="flex flex-wrap gap-1.5">
            {PERSONA_PRESETS.map((preset) => {
              const isActive = settings.persona === preset.text;
              return (
                <button
                  key={preset.label}
                  type="button"
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    isActive
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "bg-muted/50 border-border hover:border-primary/30 text-muted-foreground"
                  }`}
                  onClick={() => update("persona", isActive ? "" : preset.text)}
                >
                  {isActive ? "✓ " : ""}{preset.label}
                </button>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">
            빠른 선택 후 직접 수정도 가능합니다. 비워두면 AI가 자동 판단합니다.
          </p>
        </div>

        {/* Product name */}
        <div className="space-y-2">
          <Label htmlFor="productName" className="text-base font-semibold">
            제품명
          </Label>
          <Input
            id="productName"
            placeholder="예: 아이오페 레티놀 슈퍼 바운스 세럼"
            value={settings.productName}
            onChange={(e) => update("productName", e.target.value)}
            className="text-base"
          />
          <p className="text-sm text-muted-foreground">
            홍보할 제품이 있다면 제품명을 입력하세요
          </p>
        </div>

        {/* Product advantages */}
        <div className="space-y-2">
          <Label
            htmlFor="productAdvantages"
            className="text-base font-semibold"
          >
            내 제품의 장점
          </Label>
          <Textarea
            id="productAdvantages"
            placeholder="예: 레티놀 성분이 피부 재생에 효과적, 민감성 피부에도 자극 없음, 가성비 좋음"
            value={settings.productAdvantages}
            onChange={(e) => update("productAdvantages", e.target.value)}
            className="min-h-[80px] resize-y text-base"
          />
          <p className="text-sm text-muted-foreground">
            제품의 강점이나 차별점을 입력하면 글에 자연스럽게 반영됩니다
          </p>
        </div>

        {/* Product link */}
        <div className="space-y-2">
          <Label htmlFor="productLink" className="text-base font-semibold">
            제품 링크
          </Label>
          <Input
            id="productLink"
            placeholder="예: https://smartstore.naver.com/brand/products/12345"
            value={settings.productLink}
            onChange={(e) => update("productLink", e.target.value)}
            className="text-base"
          />
          <p className="text-sm text-muted-foreground">
            {settings.productLink.trim()
              ? "글 하단에 구매 링크가 자연스럽게 포함됩니다"
              : "링크를 비워두면 제품명만 언급하고 링크는 생성하지 않습니다"}
          </p>
        </div>

        {/* Requirements */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="requirements" className="text-base font-semibold">
              추가 요구사항
            </Label>
            <Guide
              open={guideOpen === "requirements"}
              onToggle={() =>
                setGuideOpen(
                  guideOpen === "requirements" ? null : "requirements"
                )
              }
            >
              <p className="font-semibold text-blue-700 dark:text-blue-300">
                추가 요구사항이란?
              </p>
              <p className="text-muted-foreground">
                AI에게 전달하는 <strong>세부 지시사항</strong>입니다.
                여기에 적은 내용이 그대로 AI 프롬프트에 반영되어 글의 톤, 타겟, 스타일 등을 조절합니다.
              </p>
              <p className="font-semibold text-blue-700 dark:text-blue-300 pt-1">
                클릭하면 바로 추가됩니다
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {REQUIREMENT_SUGGESTIONS.map((suggestion) => {
                  const isActive = settings.requirements.includes(
                    suggestion.text
                  );
                  return (
                    <button
                      key={suggestion.text}
                      type="button"
                      data-guide
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        isActive
                          ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                          : "bg-white dark:bg-white/10 border-border hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950 text-muted-foreground"
                      }`}
                      onClick={() => {
                        if (isActive) {
                          const newReq = settings.requirements
                            .replace(suggestion.text, "")
                            .replace(/,\s*,/g, ",")
                            .replace(/^,\s*|,\s*$/g, "")
                            .trim();
                          update("requirements", newReq);
                        } else {
                          const newReq = settings.requirements.trim()
                            ? `${settings.requirements.trim()}, ${suggestion.text}`
                            : suggestion.text;
                          update("requirements", newReq);
                        }
                      }}
                    >
                      {isActive ? "✓ " : ""}
                      {suggestion.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-muted-foreground text-xs pt-1">
                태그 선택 후 직접 수정도 가능합니다. 자유롭게 조합하세요.
              </p>
            </Guide>
          </div>
          <Textarea
            id="requirements"
            placeholder="예: 20대 여성 타겟, 친근한 말투, 전후 사진 언급 포함"
            value={settings.requirements}
            onChange={(e) => update("requirements", e.target.value)}
            className="min-h-[80px] resize-y text-base"
          />
          <p className="text-sm text-muted-foreground">
            글의 톤, 타겟 독자, 특별히 포함할 내용 등을 자유롭게 입력하세요
          </p>
        </div>

        {/* Character count range */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">
            글자 수 설정 <span className="text-destructive">*</span>
          </Label>
          <div className="grid gap-2.5">
            {CHAR_COUNT_OPTIONS.map((option) => {
              const isSelected = settings.charCountRange === option.value;
              const isRecommended = option.recommended;
              return (
                <label
                  key={option.value}
                  className={`relative flex items-center gap-3 rounded-md border p-3.5 cursor-pointer transition-colors ${
                    isSelected
                      ? isRecommended
                        ? "border-green-500 bg-green-500/10"
                        : "border-primary bg-primary/5"
                      : isRecommended
                        ? "border-green-500/40 bg-green-500/5 hover:border-green-500/60"
                        : "hover:border-muted-foreground/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="charCountRange"
                    value={option.value}
                    checked={isSelected}
                    onChange={(e) => update("charCountRange", e.target.value)}
                    className="accent-green-500 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">
                        {option.label}
                      </span>
                      {isRecommended && (
                        <span className="text-xs font-bold text-green-500 bg-green-500/15 px-1.5 py-0.5 rounded">
                          추천
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm ${isRecommended ? "text-green-500/80" : "text-muted-foreground"}`}
                    >
                      {option.desc}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* 이미지 설명은 항상 포함 (체크박스 제거됨) */}
      </div>
    </div>
  );
}

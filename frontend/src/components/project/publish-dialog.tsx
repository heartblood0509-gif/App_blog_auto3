"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Send,
  RefreshCw,
  XCircle,
  Plus,
  Trash2,
} from "lucide-react";
import type {
  PublishProgress,
  ForbiddenCheckResult,
  NaverAccount,
  FormattingTheme,
} from "@/types";
import type { BlogImage } from "./blog-image-generator";
import {
  checkConnection,
  publishBlog,
  subscribeToProgress,
  checkForbiddenWords,
  autoReplaceForbidden,
  getAccounts,
  addAccount,
  deleteAccount,
} from "@/lib/publisher-client";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  images: BlogImage[];
  title: string;
  keywords: string;
}

const ACCENT_COLORS = [
  { label: "주황빨강", value: "rgb(255, 95, 69)" },
  { label: "진파랑", value: "rgb(0, 78, 130)" },
  { label: "진빨강", value: "rgb(186, 0, 0)" },
  { label: "갈색", value: "rgb(130, 63, 0)" },
  { label: "진분홍", value: "rgb(187, 0, 92)" },
  { label: "파랑", value: "rgb(0, 120, 203)" },
];

const QUOTE_STYLES = [
  { label: "기본", value: "default" },
  { label: "말풍선", value: "bubble" },
  { label: "세로선", value: "line" },
  { label: "밑줄", value: "underline" },
  { label: "꺾쇠", value: "corner" },
];

type DialogStep = "connecting" | "settings" | "publishing" | "result";

export function PublishDialog({
  open,
  onOpenChange,
  content,
  images,
  title,
  keywords,
}: PublishDialogProps) {
  const [step, setStep] = useState<DialogStep>("connecting");
  // 금칙어 자동 대체 시 로컬에서 관리하는 콘텐츠
  const [localContent, setLocalContent] = useState(content);
  const [connected, setConnected] = useState(false);

  // 설정
  const [accounts, setAccounts] = useState<NaverAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accentColor, setAccentColor] = useState(ACCENT_COLORS[0].value);
  const [headingQuote, setHeadingQuote] = useState("line");
  const [bodyQuote, setBodyQuote] = useState("bubble");
  const [autoPublish, setAutoPublish] = useState(false);

  // 금칙어
  const [forbiddenResult, setForbiddenResult] =
    useState<ForbiddenCheckResult | null>(null);
  const [checkingForbidden, setCheckingForbidden] = useState(false);

  // 인라인 계정 추가
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccUsername, setNewAccUsername] = useState("");
  const [newAccPassword, setNewAccPassword] = useState("");
  const [newAccNickname, setNewAccNickname] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);

  // 발행 진행
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const [publishError, setPublishError] = useState("");
  const [resultUrl, setResultUrl] = useState("");

  // 서버 연결 확인
  useEffect(() => {
    if (!open) return;
    setStep("connecting");
    setProgress(null);
    setPublishError("");
    setResultUrl("");

    let cancelled = false;
    (async () => {
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
        const ok = await checkConnection();
        if (ok) {
          setConnected(true);
          // 계정 + 금칙어 동시 로드
          const [accs] = await Promise.all([getAccounts()]);
          setAccounts(accs);
          if (accs.length > 0) setSelectedAccountId(accs[0].id);
          setStep("settings");

          // 금칙어 자동 검사
          setCheckingForbidden(true);
          try {
            const result = await checkForbiddenWords(localContent, keywords);
            setForbiddenResult(result);
          } catch {
            // 검사 실패해도 진행 가능
          }
          setCheckingForbidden(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      // 15초 타임아웃
      if (!cancelled) setConnected(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, content, keywords]);

  // 발행 실행
  const handlePublish = useCallback(async () => {
    if (!selectedAccountId) return;

    setStep("publishing");
    setProgress({ step: "start", progress: 0, message: "발행 준비 중..." });
    setPublishError("");

    const theme: FormattingTheme = {
      name: "custom",
      accent_color: accentColor,
      heading_quote_style: headingQuote,
      body_quote_style: bodyQuote,
    };

    try {
      const { task_id } = await publishBlog({
        content_md: localContent,
        images: images.map((img) => ({
          index: img.index,
          data: img.data,
          mimeType: img.mimeType,
          description: img.description,
        })),
        title,
        keyword: keywords,
        naver_account_id: selectedAccountId,
        formatting_theme: theme,
        auto_publish: autoPublish,
      });

      subscribeToProgress(
        task_id,
        (p) => {
          setProgress(p);
          if (p.step === "done") {
            setResultUrl(p.url || "");
            setStep("result");
          } else if (p.step === "error") {
            setPublishError(p.message);
            setStep("result");
          }
        },
        () => {
          // SSE 종료
        }
      );
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "발행 요청 실패");
      setStep("result");
    }
  }, [
    selectedAccountId,
    localContent,
    images,
    title,
    keywords,
    accentColor,
    headingQuote,
    bodyQuote,
    autoPublish,
  ]);

  // content prop이 바뀌면 localContent도 갱신
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  // 선택된 계정 삭제
  const handleDeleteAccount = useCallback(async () => {
    if (!selectedAccountId) return;
    const acc = accounts.find((a) => a.id === selectedAccountId);
    if (!acc) return;
    if (!confirm(`"${acc.nickname || acc.username}" 계정을 삭제하시겠습니까?`)) return;

    try {
      await deleteAccount(selectedAccountId);
      const remaining = accounts.filter((a) => a.id !== selectedAccountId);
      setAccounts(remaining);
      setSelectedAccountId(remaining[0]?.id || "");
    } catch {
      // 무시
    }
  }, [selectedAccountId, accounts]);

  // 인라인 계정 추가
  const handleAddAccount = useCallback(async () => {
    if (!newAccUsername.trim()) return;
    setAddingAccount(true);
    try {
      const acc = await addAccount(newAccUsername.trim(), newAccPassword, newAccNickname.trim());
      setAccounts((prev) => [...prev, acc]);
      setSelectedAccountId(acc.id);
      setNewAccUsername("");
      setNewAccPassword("");
      setNewAccNickname("");
      setShowAddAccount(false);
    } catch (e) {
      // 에러는 무시 (이미 등록된 계정 등)
    }
    setAddingAccount(false);
  }, [newAccUsername, newAccPassword, newAccNickname]);

  // 금칙어 자동 대체
  const handleAutoReplace = useCallback(async () => {
    try {
      const result = await autoReplaceForbidden(localContent);
      setLocalContent(result.content);
      // 재검사
      setCheckingForbidden(true);
      const check = await checkForbiddenWords(result.content, keywords);
      setForbiddenResult(check);
      setCheckingForbidden(false);
    } catch {
      // 무시
    }
  }, [localContent, keywords]);

  const PUBLISH_STEPS = [
    { key: "login", label: "로그인" },
    { key: "navigate", label: "에디터 이동" },
    { key: "title", label: "제목 입력" },
    { key: "body", label: "본문 입력" },
    { key: "images", label: "이미지 업로드" },
    { key: "publish", label: "발행" },
  ];

  const getStepIcon = (stepKey: string) => {
    if (!progress) return <Circle className="h-4 w-4 text-muted-foreground" />;
    const currentIdx = PUBLISH_STEPS.findIndex(
      (s) => s.key === progress.step
    );
    const stepIdx = PUBLISH_STEPS.findIndex((s) => s.key === stepKey);

    if (stepIdx < currentIdx || progress.step === "done") {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (stepIdx === currentIdx) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        // 발행 진행 중에는 닫기 불가 (SSE 끊김 방지)
        if (!newOpen && step === "publishing") return;
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "connecting" && "서버 연결 중..."}
            {step === "settings" && "네이버 발행 설정"}
            {step === "publishing" && "발행 진행 중"}
            {step === "result" && (publishError ? "발행 실패" : "발행 완료")}
          </DialogTitle>
        </DialogHeader>

        {/* ── 서버 연결 대기 ── */}
        {step === "connecting" && (
          <div className="flex flex-col items-center gap-4 py-8">
            {connected === false ? (
              <>
                <AlertTriangle className="h-12 w-12 text-yellow-500" />
                <p className="text-center text-sm text-muted-foreground">
                  BlogPublisher 앱이 실행되지 않았습니다.
                  <br />
                  앱을 실행한 후 다시 시도해주세요.
                </p>
              </>
            ) : (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                <p className="text-sm text-muted-foreground">
                  발행 서버에 연결 중...
                </p>
              </>
            )}
          </div>
        )}

        {/* ── 설정 ── */}
        {step === "settings" && (
          <div className="space-y-4">
            {/* 네이버 계정 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>네이버 계정</Label>
                {!showAddAccount && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddAccount(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    계정 추가
                  </Button>
                )}
              </div>

              {/* 계정 선택 드롭다운 + 삭제 버튼 */}
              {accounts.length > 0 && !showAddAccount && (
                <div className="flex gap-2">
                  <Select
                    value={selectedAccountId}
                    onValueChange={(v) => setSelectedAccountId(v || "")}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="계정 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nickname ? `${a.nickname} (${a.username})` : a.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAccountId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDeleteAccount}
                      title="선택한 계정 삭제"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              )}

              {/* 계정 추가 인라인 폼 */}
              {(accounts.length === 0 || showAddAccount) && (
                <div className="rounded-lg border p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">네이버 아이디</Label>
                      <Input
                        value={newAccUsername}
                        onChange={(e) => setNewAccUsername(e.target.value)}
                        placeholder="naver_id"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">비밀번호</Label>
                      <Input
                        type="password"
                        value={newAccPassword}
                        onChange={(e) => setNewAccPassword(e.target.value)}
                        placeholder="비밀번호"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">별명 (선택)</Label>
                    <Input
                      value={newAccNickname}
                      onChange={(e) => setNewAccNickname(e.target.value)}
                      placeholder="예: 회사 블로그, 개인 블로그"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddAccount}
                      disabled={!newAccUsername.trim() || addingAccount}
                    >
                      {addingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : "추가"}
                    </Button>
                    {accounts.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddAccount(false)}
                      >
                        취소
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 테마 색상 */}
            <div className="space-y-2">
              <Label>강조 색상</Label>
              <div className="flex gap-2">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      accentColor === c.value
                        ? "border-foreground scale-110"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setAccentColor(c.value)}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* 인용구 스타일 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>소제목 인용구</Label>
                <Select value={headingQuote} onValueChange={(v) => setHeadingQuote(v || "line")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>본문 인용구</Label>
                <Select value={bodyQuote} onValueChange={(v) => setBodyQuote(v || "bubble")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_STYLES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 자동 발행 */}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={(e) => setAutoPublish(e.target.checked)}
                className="rounded"
              />
              자동 발행 (체크 안 하면 입력만 하고 수동 확인)
            </label>

            {/* 금칙어 검사 결과 */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">금칙어 검사</span>
                {checkingForbidden ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      setCheckingForbidden(true);
                      try {
                        const r = await checkForbiddenWords(localContent, keywords);
                        setForbiddenResult(r);
                      } catch {}
                      setCheckingForbidden(false);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    재검사
                  </Button>
                )}
              </div>

              {forbiddenResult && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {forbiddenResult.summary}
                  </p>
                  {forbiddenResult.forbidden_words.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {forbiddenResult.forbidden_words.slice(0, 10).map((w, i) => (
                        <Badge
                          key={i}
                          variant={
                            w.category === "replaceable"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {w.word}
                          {w.suggestion ? ` → ${w.suggestion}` : ""}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {forbiddenResult.forbidden_words.some(
                    (w) => w.category === "replaceable"
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoReplace}
                    >
                      자동 대체 후 발행
                    </Button>
                  )}
                </>
              )}
            </div>

            {/* 절대 금지어 경고 */}
            {forbiddenResult?.has_critical_violations && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-medium text-destructive">
                  절대 금지어가 포함되어 있습니다
                </p>
                <p className="text-xs text-muted-foreground">
                  아래 단어를 글에서 직접 수정한 후 "재검사"를 눌러주세요:
                </p>
                <div className="flex flex-wrap gap-1">
                  {forbiddenResult.forbidden_words
                    .filter((w) => w.category !== "replaceable" && w.category !== "cliche")
                    .map((w, i) => (
                      <Badge key={i} variant="destructive">
                        "{w.word}" — {w.line}번째 줄
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {/* 발행 버튼 */}
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={handlePublish}
                disabled={!selectedAccountId}
              >
                <Send className="h-4 w-4 mr-2" />
                {forbiddenResult?.has_critical_violations
                  ? "⚠️ 금칙어 경고 있음 — 발행 시작"
                  : "발행 시작"}
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
            </div>
          </div>
        )}

        {/* ── 발행 진행 ── */}
        {step === "publishing" && (
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              {PUBLISH_STEPS.map((s) => (
                <div key={s.key} className="flex items-center gap-3">
                  {getStepIcon(s.key)}
                  <span
                    className={`text-sm ${
                      progress?.step === s.key
                        ? "font-medium text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {progress && (
              <>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  {progress.message}
                </p>
              </>
            )}

            <p className="text-xs text-center text-muted-foreground pt-2">
              발행 중입니다. 완료될 때까지 기다려주세요.
            </p>
          </div>
        )}

        {/* ── 결과 ── */}
        {step === "result" && (
          <div className="flex flex-col items-center gap-4 py-6">
            {publishError ? (
              <>
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm text-center text-destructive">
                  {publishError}
                </p>
                <Button onClick={() => setStep("settings")}>
                  다시 시도
                </Button>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-12 w-12 text-green-500" />
                <p className="text-sm font-medium">발행 완료!</p>
                {resultUrl && (
                  <a
                    href={resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-500 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    발행된 글 보기
                  </a>
                )}
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  닫기
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

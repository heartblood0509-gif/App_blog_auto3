"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";

type ProgressData = {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
};

type Phase = "idle" | "downloading" | "downloaded";

const fmtMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);
const fmtSpeed = (bps: number) => {
  if (bps <= 0) return "—";
  const mbps = bps / 1024 / 1024;
  return mbps >= 1 ? `${mbps.toFixed(1)} MB/s` : `${(bps / 1024).toFixed(0)} KB/s`;
};
const fmtETA = (secondsRemaining: number) => {
  if (!isFinite(secondsRemaining) || secondsRemaining <= 0) return "";
  if (secondsRemaining < 60) return `약 ${Math.ceil(secondsRemaining)}초 남음`;
  return `약 ${Math.ceil(secondsRemaining / 60)}분 남음`;
};

export function UpdateProgressDialog() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    const api = (typeof window !== "undefined" ? (window as any).electronAPI : null) as
      | {
          onUpdaterProgress: (cb: (d: ProgressData) => void) => () => void;
          onUpdaterDownloaded: (cb: () => void) => () => void;
          onUpdaterError: (cb: (msg: string) => void) => () => void;
          quitAndInstall: () => Promise<void>;
        }
      | null;

    if (!api?.onUpdaterProgress) return;

    let toastShown = false;

    const offProgress = api.onUpdaterProgress((data) => {
      if (!toastShown) {
        toastShown = true;
        toast.info("업데이트 다운로드를 시작했어요. 백그라운드에서 진행됩니다.");
      }
      setProgress(data);
      setPhase((prev) => (prev === "downloaded" ? prev : "downloading"));
    });

    const offDownloaded = api.onUpdaterDownloaded(() => {
      setPhase("downloaded");
    });

    const offError = api.onUpdaterError((msg) => {
      toast.error(`업데이트 실패: ${msg || "알 수 없는 오류"}`);
      setPhase("idle");
      setProgress(null);
    });

    return () => {
      offProgress();
      offDownloaded();
      offError();
    };
  }, []);

  const open = phase !== "idle";

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await (window as any).electronAPI?.quitAndInstall?.();
    } catch {
      setRestarting(false);
      toast.error("재시작에 실패했어요. 앱을 직접 종료 후 다시 실행해주세요.");
    }
  };

  const percent = progress ? Math.max(0, Math.min(100, progress.percent)) : 0;
  const remainingSec =
    progress && progress.bytesPerSecond > 0
      ? (progress.total - progress.transferred) / progress.bytesPerSecond
      : 0;

  const handleDismiss = () => {
    // 다운로드 완료 후 "나중에" — 다이얼로그 숨김 (autoInstallOnAppQuit이 다음 종료 시 설치)
    setPhase("idle");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && phase === "downloaded") handleDismiss(); }}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={phase === "downloaded"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {phase === "downloaded" ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                업데이트 준비 완료
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                업데이트 다운로드 중
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                phase === "downloaded" ? "bg-green-500" : "bg-blue-500"
              }`}
              style={{ width: `${phase === "downloaded" ? 100 : percent}%` }}
            />
          </div>

          {phase === "downloading" && progress && (
            <div className="space-y-1 text-center">
              <p className="text-2xl font-semibold tabular-nums">
                {percent.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {fmtMB(progress.transferred)} MB / {fmtMB(progress.total)} MB ·{" "}
                {fmtSpeed(progress.bytesPerSecond)}
              </p>
              {remainingSec > 0 && (
                <p className="text-xs text-muted-foreground">{fmtETA(remainingSec)}</p>
              )}
            </div>
          )}

          {phase === "downloaded" && (
            <p className="text-sm text-center text-muted-foreground">
              새 버전이 준비됐어요. 재시작하면 자동으로 설치됩니다.
            </p>
          )}

          <p className="text-xs text-center text-muted-foreground pt-1">
            {phase === "downloading"
              ? "백그라운드에서 계속됩니다. 다른 작업을 하셔도 됩니다."
              : ""}
          </p>

          {phase === "downloaded" && (
            <div className="flex justify-center gap-2">
              <Button onClick={handleRestart} disabled={restarting}>
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${restarting ? "animate-spin" : ""}`}
                />
                {restarting ? "재시작 중…" : "지금 재시작"}
              </Button>
              <Button variant="outline" onClick={handleDismiss} disabled={restarting}>
                나중에
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

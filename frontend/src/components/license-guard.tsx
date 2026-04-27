"use client";

import { useEffect, useRef, useState } from "react";
import { LicenseScreen } from "./license-screen";
import {
  getLicenseKey,
  getLicenseCache,
  isOfflineCacheValid,
} from "@/lib/license-store";
import { validateLicense, activateMachine, sendHeartbeat } from "@/lib/keygen-client";

interface LicenseGuardProps {
  children: React.ReactNode;
}

type LicenseStatus = "loading" | "no-key" | "validating" | "active" | "error";

// 개발 모드: Keygen 미설정 시 라이선스 체크 건너뛰기
const isDev = !process.env.NEXT_PUBLIC_KEYGEN_ACCOUNT_ID;

export function LicenseGuard({ children }: LicenseGuardProps) {
  const [status, setStatus] = useState<LicenseStatus>(
    isDev ? "active" : "loading"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isDev) return; // 개발 모드: 라이선스 체크 안 함
    checkLicense();
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkLicense() {
    const key = getLicenseKey();

    // 키 없음
    if (!key) {
      setStatus("no-key");
      return;
    }

    setStatus("validating");

    // 온라인 검증 시도
    const result = await validateLicense(key);

    if (result.valid) {
      setStatus("active");
      startHeartbeat(key, result.licenseId);
      return;
    }

    // 기기 등록 필요
    if (result.code === "NEEDS_ACTIVATION") {
      // 먼저 licenseId 없이 활성화 시도 (Keygen이 키로 찾아줌)
      const activation = await activateMachine(key, "");
      if (activation.success) {
        setStatus("active");
        if (activation.machineId) {
          startHeartbeat(key, activation.machineId);
        }
        return;
      }

      setErrorMessage(activation.message);
      setStatus("error");
      return;
    }

    // 네트워크 에러 → 오프라인 캐시 확인
    if (result.code === "NETWORK_ERROR") {
      if (isOfflineCacheValid()) {
        setStatus("active");
        return;
      }
      setErrorMessage("오프라인 상태입니다. 인터넷 연결 후 다시 시도해주세요.");
      setStatus("error");
      return;
    }

    // 그 외 에러
    setErrorMessage(result.message);
    setStatus("error");
  }

  function startHeartbeat(key: string, idOrLicenseId: string) {
    const cache = getLicenseCache();
    const machineId = cache?.machineId || idOrLicenseId;
    if (!machineId) return;

    // 30분마다 하트비트
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat(key, machineId);
    }, 30 * 60 * 1000);
  }

  function handleActivated() {
    setErrorMessage("");
    setStatus("loading");
    checkLicense();
  }

  // 로딩 중
  if (status === "loading" || status === "validating") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">라이선스 확인 중...</p>
        </div>
      </div>
    );
  }

  // 키 입력 필요 또는 에러
  if (status === "no-key" || status === "error") {
    return (
      <LicenseScreen
        onActivated={handleActivated}
        errorMessage={errorMessage}
      />
    );
  }

  // 활성화됨
  return <>{children}</>;
}

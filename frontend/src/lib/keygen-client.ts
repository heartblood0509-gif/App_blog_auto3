/**
 * Keygen API 클라이언트
 * - 라이선스 검증
 * - 기기 등록/해제
 * - 하트비트
 */

import {
  saveLicenseCache,
  type LicenseCache,
} from "./license-store";

const KEYGEN_API = "https://api.keygen.sh/v1/accounts";
const ACCOUNT_ID = process.env.NEXT_PUBLIC_KEYGEN_ACCOUNT_ID || "";

/** 기기 핑거프린트 생성 (간단 버전 — Electron에서는 더 정확한 값 사용) */
function getFingerprint(): string {
  if (typeof window !== "undefined" && (window as any).electronAPI?.getFingerprint) {
    return (window as any).electronAPI.getFingerprint();
  }
  // 브라우저 폴백: 랜덤 ID 생성 후 저장
  const KEY = "blogpublisher-device-fp";
  let fp = localStorage.getItem(KEY);
  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem(KEY, fp);
  }
  return fp;
}

export type ValidateResult =
  | { valid: true; licenseId: string; meta?: Record<string, any> }
  | { valid: false; code: string; message: string };

/** 라이선스 키 검증 */
export async function validateLicense(licenseKey: string): Promise<ValidateResult> {
  try {
    const res = await fetch(`${KEYGEN_API}/${ACCOUNT_ID}/licenses/actions/validate-key`, {
      method: "POST",
      headers: { "Content-Type": "application/vnd.api+json", Accept: "application/vnd.api+json" },
      body: JSON.stringify({
        meta: {
          key: licenseKey,
          scope: { fingerprint: getFingerprint() },
        },
      }),
    });

    const data = await res.json();
    const code = data?.meta?.code || "";
    const licenseId = data?.data?.id || "";

    if (code === "VALID" || code === "FINGERPRINT_SCOPE_MATCH") {
      // 캐시 저장
      saveLicenseCache({
        valid: true,
        licenseId,
        machineId: getFingerprint(),
        lastChecked: new Date().toISOString(),
      });
      return { valid: true, licenseId };
    }

    // 기기 미등록 — 등록 필요
    if (code === "FINGERPRINT_SCOPE_MISMATCH" || code === "NO_MACHINES" || code === "NO_MACHINE") {
      return { valid: false, code: "NEEDS_ACTIVATION", message: "기기 등록이 필요합니다." };
    }

    if (code === "TOO_MANY_MACHINES") {
      return { valid: false, code, message: "기기 수 제한을 초과했습니다. 다른 기기에서 해제 후 다시 시도하세요." };
    }

    if (code === "EXPIRED") {
      return { valid: false, code, message: "라이선스가 만료되었습니다." };
    }

    if (code === "SUSPENDED") {
      return { valid: false, code, message: "라이선스가 정지되었습니다." };
    }

    return { valid: false, code: code || "INVALID", message: "유효하지 않은 라이선스 키입니다." };
  } catch {
    return { valid: false, code: "NETWORK_ERROR", message: "서버에 연결할 수 없습니다." };
  }
}

/** 기기 등록 (활성화) */
export async function activateMachine(licenseKey: string, licenseId: string): Promise<{ success: boolean; message: string; machineId?: string }> {
  try {
    const fingerprint = getFingerprint();

    const res = await fetch(`${KEYGEN_API}/${ACCOUNT_ID}/machines`, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.api+json",
        Accept: "application/vnd.api+json",
        Authorization: `License ${licenseKey}`,
      },
      body: JSON.stringify({
        data: {
          type: "machines",
          attributes: {
            fingerprint,
            name: `${navigator.platform} - ${new Date().toLocaleDateString("ko-KR")}`,
          },
          relationships: {
            license: { data: { type: "licenses", id: licenseId } },
          },
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const machineId = data?.data?.id || "";

      saveLicenseCache({
        valid: true,
        licenseId,
        machineId,
        lastChecked: new Date().toISOString(),
      });

      return { success: true, message: "기기 등록 완료", machineId };
    }

    const err = await res.json().catch(() => ({}));
    const code = err?.errors?.[0]?.code || "";

    if (code === "MACHINES_LIMIT_EXCEEDED") {
      return { success: false, message: "기기 수 제한 초과. 다른 기기에서 해제가 필요합니다." };
    }

    return { success: false, message: err?.errors?.[0]?.detail || "기기 등록 실패" };
  } catch {
    return { success: false, message: "서버 연결 실패" };
  }
}

/** 하트비트 전송 */
export async function sendHeartbeat(licenseKey: string, machineId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${KEYGEN_API}/${ACCOUNT_ID}/machines/${machineId}/actions/ping`,
      {
        method: "POST",
        headers: {
          Authorization: `License ${licenseKey}`,
          Accept: "application/vnd.api+json",
        },
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** 기기 해제 (비활성화) */
export async function deactivateMachine(licenseKey: string, machineId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${KEYGEN_API}/${ACCOUNT_ID}/machines/${machineId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `License ${licenseKey}`,
          Accept: "application/vnd.api+json",
        },
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

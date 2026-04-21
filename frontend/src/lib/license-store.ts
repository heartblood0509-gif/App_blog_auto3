/**
 * 라이선스 키 로컬 저장/로드
 * localStorage에 라이선스 키와 검증 캐시를 저장
 */

const LICENSE_KEY_STORAGE = "blogpublisher-license-key";
const LICENSE_CACHE_STORAGE = "blogpublisher-license-cache";

export interface LicenseCache {
  valid: boolean;
  licenseId: string;
  machineId: string;
  lastChecked: string; // ISO date
  expiresAt?: string;
}

/** 저장된 라이선스 키 로드 */
export function getLicenseKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LICENSE_KEY_STORAGE);
}

/** 라이선스 키 저장 */
export function saveLicenseKey(key: string): void {
  localStorage.setItem(LICENSE_KEY_STORAGE, key);
}

/** 라이선스 키 삭제 */
export function clearLicenseKey(): void {
  localStorage.removeItem(LICENSE_KEY_STORAGE);
  localStorage.removeItem(LICENSE_CACHE_STORAGE);
}

/** 검증 캐시 로드 */
export function getLicenseCache(): LicenseCache | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LICENSE_CACHE_STORAGE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 검증 캐시 저장 */
export function saveLicenseCache(cache: LicenseCache): void {
  localStorage.setItem(LICENSE_CACHE_STORAGE, JSON.stringify(cache));
}

/**
 * 오프라인 검증 — 캐시가 유효한지 확인
 * 마지막 온라인 검증 후 7일까지 허용
 */
export function isOfflineCacheValid(): boolean {
  const cache = getLicenseCache();
  if (!cache || !cache.valid) return false;

  const lastChecked = new Date(cache.lastChecked);
  const now = new Date();
  const diffDays = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);

  return diffDays <= 7;
}

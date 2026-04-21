/**
 * Electron 기기 핑거프린트 생성
 * 고유한 기기 식별값을 생성하여 Keygen 기기 등록에 사용
 */

import * as os from "os";
import * as crypto from "crypto";

/**
 * 기기 고유 핑거프린트 생성
 * OS + 호스트명 + CPU + 사용자명 조합의 해시
 */
export function generateFingerprint(): string {
  const components = [
    os.platform(),
    os.hostname(),
    os.arch(),
    os.cpus()[0]?.model || "unknown-cpu",
    os.userInfo().username,
    os.totalmem().toString(),
  ];

  const raw = components.join("|");
  return crypto.createHash("sha256").update(raw).digest("hex").substring(0, 32);
}

/**
 * 기기 이름 (Keygen 대시보드에 표시)
 */
export function getDeviceName(): string {
  const platform = os.platform() === "darwin" ? "macOS" : os.platform() === "win32" ? "Windows" : "Linux";
  return `${platform} - ${os.hostname()}`;
}

/**
 * Electron Preload — 렌더러-메인 프로세스 브릿지
 * 보안상 contextIsolation을 유지하면서 필요한 API만 노출
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // 앱 정보
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getPlatform: () => process.platform,

  // Python 서버 상태
  getPythonStatus: () => ipcRenderer.invoke("get-python-status"),

  // 외부 링크 열기
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),

  // 기기 핑거프린트 (Keygen 라이선스용)
  getFingerprint: () => ipcRenderer.invoke("get-fingerprint"),
});

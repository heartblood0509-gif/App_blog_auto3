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

  // 자동 업데이트 — 다운로드 진행률/완료/에러 구독
  // 반환값은 cleanup 함수 (React useEffect에서 호출)
  onUpdaterProgress: (
    cb: (data: {
      percent: number;
      transferred: number;
      total: number;
      bytesPerSecond: number;
    }) => void,
  ) => {
    const listener = (_e: Electron.IpcRendererEvent, data: any) => cb(data);
    ipcRenderer.on("updater:progress", listener);
    return () => ipcRenderer.removeListener("updater:progress", listener);
  },
  onUpdaterDownloaded: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("updater:downloaded", listener);
    return () => ipcRenderer.removeListener("updater:downloaded", listener);
  },
  onUpdaterError: (cb: (message: string) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, message: string) => cb(message);
    ipcRenderer.on("updater:error", listener);
    return () => ipcRenderer.removeListener("updater:error", listener);
  },
  quitAndInstall: () => ipcRenderer.invoke("updater:quit-and-install"),
});

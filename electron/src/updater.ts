/**
 * 자동 업데이트 (electron-updater)
 * GitHub Releases에서 새 버전 확인 후 다운로드 & 설치
 */

import { autoUpdater } from "electron-updater";
import { BrowserWindow, dialog } from "electron";

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", async (info) => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "업데이트 available",
      message: `새 버전 ${info.version}이 있습니다. 다운로드하시겠습니까?`,
      buttons: ["다운로드", "나중에"],
      defaultId: 0,
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-downloaded", async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "업데이트 준비 완료",
      message: "업데이트가 다운로드되었습니다. 앱을 재시작하여 설치하시겠습니까?",
      buttons: ["재시작", "나중에"],
      defaultId: 0,
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[Updater] 업데이트 확인 오류:", err.message);
  });

  // 앱 시작 후 업데이트 확인
  autoUpdater.checkForUpdates().catch(() => {
    // 오프라인이거나 설정 없으면 무시
  });
}

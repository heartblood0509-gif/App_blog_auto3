/**
 * 자동 업데이트 (electron-updater)
 * GitHub Releases에서 새 버전 확인 후 다운로드 & 설치
 */

import { autoUpdater } from "electron-updater";
import { BrowserWindow, dialog, ipcMain, shell } from "electron";

const RELEASES_URL =
  "https://github.com/heartblood0509-gif/App_blog_auto3/releases/latest";

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // 렌더러에서 "재시작" 버튼을 누르면 즉시 설치 트리거
  ipcMain.handle("updater:quit-and-install", () => {
    autoUpdater.quitAndInstall();
  });

  // 다운로드 진행률 — OS 진행률 바 + 렌더러 모달 동시 갱신
  autoUpdater.on("download-progress", (p) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(Math.max(0, Math.min(1, p.percent / 100)));
      mainWindow.webContents.send("updater:progress", {
        percent: p.percent,
        transferred: p.transferred,
        total: p.total,
        bytesPerSecond: p.bytesPerSecond,
      });
    }
  });

  autoUpdater.on("update-available", async (info) => {
    // GitHub Releases에 작성한 변경사항을 그대로 가져옴 (Mac=문자열, Win=배열)
    const rawNotes =
      typeof info.releaseNotes === "string"
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => n.note ?? "").join("\n\n")
          : "";

    // 마크다운/HTML 가볍게 정리해서 다이얼로그에 표시
    const cleanedNotes = rawNotes
      .replace(/<[^>]+>/g, "")
      .replace(/^#+\s*/gm, "")
      .trim();

    // macOS는 코드 서명이 없어 Squirrel 자동 설치가 항상 실패함.
    // 다운로드 페이지를 브라우저로 열어 사용자가 dmg를 직접 받게 한다.
    if (process.platform === "darwin") {
      const fileName = `BlogPublisher-${info.version}-arm64.dmg`;
      const installGuide = `받으실 파일: ${fileName}\n(Mac은 한 번만 직접 받아서 설치하시면 됩니다)`;
      const detail = cleanedNotes
        ? `변경사항:\n\n${cleanedNotes}\n\n${installGuide}`
        : installGuide;

      const result = await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "새 버전이 있어요",
        message: `새 버전 ${info.version}이 있어요.`,
        detail,
        buttons: ["다운로드 페이지 열기", "나중에"],
        defaultId: 0,
      });

      if (result.response === 0) {
        shell.openExternal(RELEASES_URL);
      }
      return;
    }

    // Windows: 기존 자동 업데이트 흐름
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "새 버전이 있어요",
      message: `새 버전 ${info.version}이 있어요. 다운로드하시겠습니까?`,
      detail: cleanedNotes ? `변경사항:\n\n${cleanedNotes}` : undefined,
      buttons: ["다운로드", "나중에"],
      defaultId: 0,
    });

    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-downloaded", async () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1); // OS 진행률 제거
      mainWindow.webContents.send("updater:downloaded");
    }

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
    if (!mainWindow.isDestroyed()) {
      mainWindow.setProgressBar(-1);
      mainWindow.webContents.send("updater:error", err.message);
    }
  });

  // 앱 시작 후 업데이트 확인
  autoUpdater.checkForUpdates().catch(() => {
    // 오프라인이거나 설정 없으면 무시
  });
}

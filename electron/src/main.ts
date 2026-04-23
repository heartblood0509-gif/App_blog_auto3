/**
 * BlogPublisher Electron 메인 프로세스
 * - Next.js 서버 시작
 * - Python 발행 서버 시작
 * - 앱 창 관리
 */

import { app, BrowserWindow, shell, ipcMain } from "electron";
import * as path from "path";
import { PythonManager } from "./python-manager";
import { startNextServer, getNextPort } from "./next-server";
import { generateFingerprint } from "./license-manager";
import { setupAutoUpdater } from "./updater";

let mainWindow: BrowserWindow | null = null;
let pythonManager: PythonManager | null = null;

const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "BlogPublisher",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Next.js 서버로 연결
  const nextPort = getNextPort();
  mainWindow.loadURL(`http://localhost:${nextPort}`);

  // 외부 링크는 기본 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

async function startServers() {
  console.log("[Electron] 서버 시작 중...");

  // 1. Python 발행 서버 시작
  pythonManager = new PythonManager();
  await pythonManager.start();

  // 2. Next.js 서버 시작
  await startNextServer();

  console.log("[Electron] 모든 서버 준비 완료");
}

// IPC 핸들러 등록
ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("get-fingerprint", () => generateFingerprint());
ipcMain.handle("get-python-status", () => pythonManager?.getStatus() || { running: false, port: 8100 });
ipcMain.handle("open-external", (_e, url: string) => shell.openExternal(url));

app.whenReady().then(async () => {
  await startServers();
  createWindow();

  if (!isDev && mainWindow) {
    setupAutoUpdater(mainWindow);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", async () => {
  // Python 서버 종료
  if (pythonManager) {
    await pythonManager.stop();
  }
  console.log("[Electron] 앱 종료");
});

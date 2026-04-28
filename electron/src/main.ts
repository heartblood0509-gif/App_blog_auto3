/**
 * BlogPublisher Electron 메인 프로세스
 * - Next.js 서버 시작
 * - Python 발행 서버 시작
 * - 앱 창 관리
 */

import { app, BrowserWindow, shell, ipcMain } from "electron";
import * as path from "path";
import { PythonManager } from "./python-manager";
import { startNextServer, stopNextServer, getNextPort } from "./next-server";
import { generateFingerprint } from "./license-manager";
import { setupAutoUpdater } from "./updater";

let mainWindow: BrowserWindow | null = null;
let pythonManager: PythonManager | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

// 같은 앱이 두 번 실행되면 두 번째 인스턴스는 즉시 종료하고 기존 창에 포커스
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.exit(0);
}

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

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

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

// before-quit 에서 자식 프로세스를 정리한다.
// will-quit 은 비동기 핸들러를 기다려주지 않아 Next.js/Python 종료가 누락되었음.
app.on("before-quit", async (e) => {
  if (isQuitting) return;
  e.preventDefault();
  isQuitting = true;

  console.log("[Electron] 종료 정리 시작...");
  try {
    await Promise.all([
      pythonManager ? pythonManager.stop() : Promise.resolve(),
      stopNextServer(),
    ]);
  } catch (err) {
    console.error("[Electron] 정리 중 오류:", err);
  }
  console.log("[Electron] 앱 종료");
  app.exit(0);
});

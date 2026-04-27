/**
 * Python 발행 서버 관리
 * - 개발 모드: python app.py 직접 실행
 * - 프로덕션: PyInstaller 빌드된 실행파일 실행
 */

import { ChildProcess, spawn } from "child_process";
import * as path from "path";
import { app } from "electron";
import * as http from "http";

const PYTHON_PORT = 8100;
const HEALTH_URL = `http://localhost:${PYTHON_PORT}/api/health`;

export class PythonManager {
  private process: ChildProcess | null = null;
  private isRunning = false;

  /**
   * Python 서버의 실행 파일/명령어 경로 결정
   */
  private getCommand(): { cmd: string; args: string[]; cwd: string } {
    const isDev = !app.isPackaged;

    if (isDev) {
      // 개발 모드: python app.py
      const publisherDir = path.join(__dirname, "..", "..", "publisher");
      return {
        cmd: "python",
        args: ["app.py"],
        cwd: publisherDir,
      };
    }

    // 프로덕션: extraResources에 번들된 publisher
    const resourcesPath = path.join(process.resourcesPath, "publisher");

    if (process.platform === "darwin") {
      // macOS: PyInstaller로 빌드된 실행파일 또는 python
      const execPath = path.join(resourcesPath, "dist", "BlogPublisher");
      return {
        cmd: execPath,
        args: [],
        cwd: resourcesPath,
      };
    } else {
      // Windows
      const execPath = path.join(resourcesPath, "dist", "BlogPublisher.exe");
      return {
        cmd: execPath,
        args: [],
        cwd: resourcesPath,
      };
    }
  }

  /**
   * Python 서버 시작
   */
  async start(): Promise<void> {
    // 이미 실행 중인지 확인
    if (await this.healthCheck()) {
      console.log("[Python] 서버가 이미 실행 중입니다.");
      this.isRunning = true;
      return;
    }

    const { cmd, args, cwd } = this.getCommand();
    console.log(`[Python] 서버 시작: ${cmd} ${args.join(" ")} (cwd: ${cwd})`);

    // 프로덕션: 번들된 Playwright 브라우저 경로를 환경변수로 전달
    const isDev = !app.isPackaged;
    const bundledBrowsers = !isDev
      ? path.join(process.resourcesPath, "ms-playwright")
      : undefined;
    if (bundledBrowsers) {
      console.log(`[Python] PLAYWRIGHT_BROWSERS_PATH=${bundledBrowsers}`);
    }

    this.process = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        ...(bundledBrowsers ? { PLAYWRIGHT_BROWSERS_PATH: bundledBrowsers } : {}),
      },
    });

    this.process.stdout?.on("data", (data: Buffer) => {
      console.log(`[Python] ${data.toString().trim()}`);
    });

    this.process.stderr?.on("data", (data: Buffer) => {
      console.error(`[Python:ERR] ${data.toString().trim()}`);
    });

    this.process.on("exit", (code) => {
      console.log(`[Python] 프로세스 종료 (code: ${code})`);
      this.isRunning = false;
      this.process = null;
    });

    // 서버 준비 대기 (최대 30초)
    const ready = await this.waitForReady(30);
    if (ready) {
      console.log("[Python] 서버 준비 완료!");
      this.isRunning = true;
    } else {
      console.error("[Python] 서버 시작 실패 (30초 타임아웃)");
    }
  }

  /**
   * Python 서버 종료
   */
  async stop(): Promise<void> {
    if (this.process) {
      console.log("[Python] 서버 종료 중...");
      this.process.kill("SIGTERM");

      // 3초 대기 후 강제 종료
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.process.kill("SIGKILL");
          }
          resolve();
        }, 3000);

        this.process?.on("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
      this.isRunning = false;
    }
  }

  /**
   * 헬스 체크
   */
  private healthCheck(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(HEALTH_URL, { timeout: 2000 }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * 서버 준비 대기
   */
  private async waitForReady(maxSeconds: number): Promise<boolean> {
    for (let i = 0; i < maxSeconds; i++) {
      if (await this.healthCheck()) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  }

  getStatus(): { running: boolean; port: number } {
    return { running: this.isRunning, port: PYTHON_PORT };
  }
}

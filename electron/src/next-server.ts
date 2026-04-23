/**
 * Next.js 서버 관리
 * - 개발 모드: 이미 실행 중인 next dev에 연결
 * - 프로덕션: next start를 자식 프로세스로 실행
 */

import { ChildProcess, spawn } from "child_process";
import * as path from "path";
import * as http from "http";
import { app } from "electron";

// BlogPublisher 전용 포트 (지인 PC의 다른 서비스와 충돌 방지용으로 특이한 포트 사용)
const NEXT_PORT = 3847;
let nextProcess: ChildProcess | null = null;

export function getNextPort(): number {
  return NEXT_PORT;
}

export async function startNextServer(): Promise<void> {
  const isDev = !app.isPackaged;

  if (isDev) {
    // 개발 모드: next dev가 이미 실행 중인지 확인
    const running = await checkPort(NEXT_PORT);
    if (running) {
      console.log(`[Next.js] 개발 서버가 이미 실행 중 (port ${NEXT_PORT})`);
      return;
    }

    // 개발 모드에서 next dev 시작
    const frontendDir = path.join(__dirname, "..", "..", "frontend");
    nextProcess = spawn("npm", ["run", "dev"], {
      cwd: frontendDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: { ...process.env, PORT: String(NEXT_PORT) },
    });

    nextProcess.stdout?.on("data", (data: Buffer) => {
      console.log(`[Next.js] ${data.toString().trim()}`);
    });

    nextProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[Next.js:ERR] ${msg}`);
    });
  } else {
    // 프로덕션: Next.js standalone 서버 실행
    // standalone 모드는 server.js 단독 실행 + 최소 node_modules 번들
    const frontendDir = path.join(process.resourcesPath, "frontend");
    const serverPath = path.join(frontendDir, "server.js");

    nextProcess = spawn(process.execPath, [serverPath], {
      cwd: frontendDir,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(NEXT_PORT),
        HOSTNAME: "127.0.0.1",
        ELECTRON_RUN_AS_NODE: "1",
      },
    });

    nextProcess.stdout?.on("data", (data: Buffer) => {
      console.log(`[Next.js] ${data.toString().trim()}`);
    });

    nextProcess.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[Next.js:ERR] ${msg}`);
    });
  }

  // 서버 준비 대기 (최대 30초)
  for (let i = 0; i < 30; i++) {
    if (await checkPort(NEXT_PORT)) {
      console.log(`[Next.js] 서버 준비 완료 (port ${NEXT_PORT})`);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.error("[Next.js] 서버 시작 실패 (30초 타임아웃)");
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode !== undefined);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function stopNextServer(): void {
  if (nextProcess) {
    nextProcess.kill("SIGTERM");
    nextProcess = null;
  }
}

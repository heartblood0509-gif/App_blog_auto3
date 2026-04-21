/**
 * Python 발행 서버 (localhost:8100) API 클라이언트
 */

import type {
  PublishRequest,
  PublishProgress,
  ForbiddenCheckResult,
  NaverAccount,
} from "@/types";

const PUBLISHER_URL = "http://localhost:8100";

// ─── 서버 연결 ──────────────────────────────────────

export async function checkConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${PUBLISHER_URL}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── 발행 ──────────────────────────────────────────

export async function publishBlog(
  request: PublishRequest
): Promise<{ task_id: string }> {
  const res = await fetch(`${PUBLISHER_URL}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "발행 요청 실패" }));
    throw new Error(err.detail || `발행 요청 실패 (${res.status})`);
  }

  return res.json();
}

export function subscribeToProgress(
  taskId: string,
  onProgress: (progress: PublishProgress) => void,
  onDone?: () => void
): EventSource {
  const es = new EventSource(
    `${PUBLISHER_URL}/api/publish/${taskId}/status`
  );

  es.addEventListener("progress", (e) => {
    try {
      const data = JSON.parse(e.data);
      onProgress(data);

      if (data.step === "done" || data.step === "error") {
        es.close();
        onDone?.();
      }
    } catch {
      // JSON 파싱 실패 무시
    }
  });

  es.onerror = () => {
    es.close();
    onDone?.();
  };

  return es;
}

export async function cancelPublish(taskId: string): Promise<void> {
  await fetch(`${PUBLISHER_URL}/api/publish/${taskId}/cancel`, {
    method: "POST",
  });
}

// ─── 금칙어 검증 ─────────────────────────────────────

export async function checkForbiddenWords(
  content: string,
  keyword: string
): Promise<ForbiddenCheckResult> {
  const res = await fetch(`${PUBLISHER_URL}/api/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, keyword }),
  });

  if (!res.ok) throw new Error("금칙어 검사 실패");
  return res.json();
}

export async function autoReplaceForbidden(
  content: string
): Promise<{ content: string; replaced_count: number }> {
  const res = await fetch(`${PUBLISHER_URL}/api/validate/auto-replace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!res.ok) throw new Error("자동 대체 실패");
  return res.json();
}

// ─── 네이버 계정 ──────────────────────────────────────

export async function getAccounts(): Promise<NaverAccount[]> {
  const res = await fetch(`${PUBLISHER_URL}/api/accounts`);
  if (!res.ok) throw new Error("계정 목록 조회 실패");
  return res.json();
}

export async function addAccount(
  username: string,
  password: string,
  nickname?: string,
  blogId?: string
): Promise<NaverAccount> {
  const res = await fetch(`${PUBLISHER_URL}/api/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, nickname: nickname || "", blog_id: blogId || username }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "계정 추가 실패" }));
    throw new Error(err.detail || "계정 추가 실패");
  }
  return res.json();
}

export async function updateAccount(
  accountId: string,
  data: { nickname?: string; password?: string }
): Promise<NaverAccount> {
  const res = await fetch(`${PUBLISHER_URL}/api/accounts/${accountId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("계정 수정 실패");
  return res.json();
}

export async function deleteAccount(accountId: string): Promise<void> {
  const res = await fetch(`${PUBLISHER_URL}/api/accounts/${accountId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("계정 삭제 실패");
}

export async function testLogin(
  accountId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(
    `${PUBLISHER_URL}/api/accounts/${accountId}/test-login`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("로그인 테스트 실패");
  return res.json();
}

import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getGeminiClient(apiKey?: string): GoogleGenAI {
  // If a client-provided API key is given, always create a fresh instance
  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }

  // 사용자 모드에서는 클라이언트 API 키가 필수
  const isUserMode = process.env.NEXT_PUBLIC_APP_MODE === "user";
  if (isUserMode) {
    throw new Error("API 키를 설정해주세요. 헤더의 열쇠 아이콘을 클릭하여 Gemini API 키를 입력해주세요.");
  }

  if (!client) {
    const envKey = process.env.GEMINI_API_KEY;
    if (!envKey) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }
    client = new GoogleGenAI({ apiKey: envKey });
  }
  return client;
}

/** Gemini API 에러를 사용자 친화적 메시지로 변환 */
export function formatGeminiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
    return `API 요청 한도를 초과했습니다. 잠시 후(약 30초) 다시 시도해주세요. (상세: ${msg.slice(0, 200)})`;
  }
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    return "API 키가 유효하지 않습니다. 환경 설정을 확인해주세요.";
  }
  if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
    return "AI 서버가 일시적으로 혼잡합니다. 1~2분 후 다시 시도해주세요.";
  }
  if (msg.includes("500") || msg.includes("INTERNAL")) {
    return "AI 서버에 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }
  return msg;
}

/** 429 에러 시 한 번 자동 재시도 (25초 대기) */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isRateLimit = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
    if (isRateLimit) {
      await new Promise((r) => setTimeout(r, 25000));
      return await fn();
    }
    throw error;
  }
}

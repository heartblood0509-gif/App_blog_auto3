import { getGeminiClient, formatGeminiError, withRetry } from "@/lib/gemini";
import { buildThreadsImageGenerationPrompt } from "@/lib/prompts";
import { Modality } from "@google/genai";
import { rateLimit, getClientId, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 120;

export async function POST(request: Request) {
  const { success } = rateLimit(getClientId(request), 10, 60_000);
  if (!success) return rateLimitResponse();

  try {
    const body = await request.json();
    const { threadsContent, imageAnalysis, aspectRatio = "1:1", count = 1, style = "realistic", customPrompt } = body;

    if (!threadsContent && !customPrompt) {
      return new Response(
        JSON.stringify({ error: "쓰레드 내용 또는 프롬프트가 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const clientApiKey = request.headers.get("x-api-key") || undefined;
    const client = getGeminiClient(clientApiKey);

    const images: { data: string; mimeType: string }[] = [];
    const imageCount = Math.min(count, 2);

    // 4:5 → Nano Banana에서 미지원 시 3:4로 대체
    const supportedRatios = ["1:1", "3:4", "4:3", "16:9", "9:16", "3:2", "2:3"];
    const finalRatio = supportedRatios.includes(aspectRatio) ? aspectRatio : "3:4";

    for (let i = 0; i < imageCount; i++) {
      const prompt = customPrompt || buildThreadsImageGenerationPrompt(threadsContent || "", imageAnalysis, style, i);
      try {
        const response = await withRetry(() =>
          client.models.generateContent({
            model: "gemini-3.1-flash-image-preview",
            contents: prompt,
            config: {
              responseModalities: [Modality.TEXT, Modality.IMAGE],
              imageConfig: { aspectRatio: finalRatio as any },
            },
          })
        );

        const candidates = response.candidates;
        if (candidates && candidates.length > 0) {
          const parts = candidates[0].content?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData) {
                images.push({
                  data: part.inlineData.data || "",
                  mimeType: part.inlineData.mimeType || "image/png",
                });
              }
            }
          }
        }

        // 2번째 이미지 전 5초 대기 (rate limit 방지)
        if (i < imageCount - 1) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("SAFETY") || msg.includes("safety")) {
          // Safety 에러: 이미 생성된 이미지가 있으면 그것만 반환
          if (images.length > 0) break;
          return new Response(
            JSON.stringify({ error: "이미지 생성이 거부되었습니다. 다른 주제로 시도해주세요." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
        // Rate limit 등 기타 에러: 이미 생성된 이미지가 있으면 그것만 반환
        if (images.length > 0) {
          console.error(`이미지 ${i + 1}번째 생성 실패, ${images.length}장만 반환:`, msg);
          break;
        }
        throw error;
      }
    }

    if (images.length === 0) {
      return new Response(
        JSON.stringify({ error: "이미지가 생성되지 않았습니다. 다시 시도해주세요." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ images }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = formatGeminiError(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

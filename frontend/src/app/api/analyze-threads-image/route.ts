import { getGeminiClient, formatGeminiError, withRetry } from "@/lib/gemini";
import { buildThreadsImageAnalysisPrompt } from "@/lib/prompts";
import { rateLimit, getClientId, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 120;

export async function POST(request: Request) {
  const { success } = rateLimit(getClientId(request), 10, 60_000);
  if (!success) return rateLimitResponse();

  try {
    const body = await request.json();
    const { images } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return new Response(
        JSON.stringify({ error: "이미지를 1장 이상 업로드해주세요." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const clientApiKey = request.headers.get("x-api-key") || undefined;
    const client = getGeminiClient(clientApiKey);
    const prompt = buildThreadsImageAnalysisPrompt();

    // Build multimodal content parts
    const parts: any[] = [{ text: prompt }];
    for (const img of images) {
      let base64Data: string;
      let mimeType: string;

      if (img.data.includes(",")) {
        // data URL format: "data:image/png;base64,..."
        const match = img.data.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        } else {
          base64Data = img.data.split(",")[1];
          mimeType = img.mimeType || "image/png";
        }
      } else {
        base64Data = img.data;
        mimeType = img.mimeType || "image/png";
      }

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await withRetry(() =>
            client.models.generateContentStream({
              model: "gemini-2.5-pro",
              contents: [{ role: "user", parts: parts as any }],
            })
          );

          for await (const chunk of response) {
            const text = chunk.text;
            if (text) {
              controller.enqueue(new TextEncoder().encode(text));
            }
          }

          controller.close();
        } catch (error) {
          controller.enqueue(
            new TextEncoder().encode(`\n\n[오류] ${formatGeminiError(error)}`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "요청 처리 중 오류";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

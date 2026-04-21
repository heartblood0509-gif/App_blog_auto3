import { getGeminiClient, formatGeminiError, withRetry } from "@/lib/gemini";
import {
  buildThreadsFromNewsPrompt,
  buildThreadsFromAnalysisPrompt,
} from "@/lib/prompts";
import { z } from "zod";
import { rateLimit, getClientId, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 120;

const generateThreadsSchema = z.object({
  mode: z.enum(["article", "analysis"]),
  text: z.string().optional(),
  analysis: z.string().optional(),
  topic: z.string().optional(),
  requirements: z.string().optional(),
});

export async function POST(request: Request) {
  const { success } = rateLimit(getClientId(request), 10, 60_000);
  if (!success) return rateLimitResponse();

  try {
    const body = await request.json();
    const parsed = generateThreadsSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0].message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { mode, text, analysis, topic, requirements } = parsed.data;

    // Build prompt based on mode
    let prompt: string;
    if (mode === "analysis") {
      if (!analysis || !topic) {
        return new Response(
          JSON.stringify({ error: "분석 결과와 주제를 모두 입력해주세요." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      prompt = buildThreadsFromAnalysisPrompt(analysis, topic, requirements);
    } else {
      if (!text || text.length < 50) {
        return new Response(
          JSON.stringify({ error: "기사 텍스트가 너무 짧습니다." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      prompt = buildThreadsFromNewsPrompt(text, requirements);
    }

    const clientApiKey = request.headers.get("x-api-key") || undefined;
    const client = getGeminiClient(clientApiKey);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await withRetry(() =>
            client.models.generateContentStream({
              model: "gemini-2.5-flash",
              contents: prompt,
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

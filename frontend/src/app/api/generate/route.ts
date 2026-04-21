import { generateSchema } from "@/lib/validations";
import { getGeminiClient, formatGeminiError, withRetry } from "@/lib/gemini";
import { buildGenerationPrompt } from "@/lib/prompts";
import { rateLimit, getClientId, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { success } = rateLimit(getClientId(request), 10, 60_000);
  if (!success) return rateLimitResponse();

  try {
    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0].message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { analysisResult, topic, keywords, selectedTitle, persona, productName, productAdvantages, productLink, requirements, charCountRange, includeImageDesc } = parsed.data;

    const clientApiKey = request.headers.get("x-api-key") || undefined;
    const client = getGeminiClient(clientApiKey);
    const prompt = buildGenerationPrompt(
      analysisResult,
      topic,
      keywords,
      { selectedTitle, persona, productName, productAdvantages, productLink, requirements, charCountRange, includeImageDesc }
    );

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

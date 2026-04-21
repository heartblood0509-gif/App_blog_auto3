import { titleSchema } from "@/lib/validations";
import { getGeminiClient, formatGeminiError, withRetry } from "@/lib/gemini";
import { buildTitlePrompt } from "@/lib/prompts";
import { rateLimit, getClientId, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { success } = rateLimit(getClientId(request), 10, 60_000);
  if (!success) return rateLimitResponse();

  try {
    const body = await request.json();
    const parsed = titleSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.issues[0].message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { analysisResult, topic, keywords } = parsed.data;

    const clientApiKey = request.headers.get("x-api-key") || undefined;
    const client = getGeminiClient(clientApiKey);
    const prompt = buildTitlePrompt(analysisResult, topic, keywords);

    const response = await withRetry(() =>
      client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      })
    );

    const text = response.text?.trim() || "";

    // Parse JSON array from response
    try {
      // Extract JSON array even if wrapped in markdown code blocks
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return new Response(
          JSON.stringify({ error: "제목 생성 결과를 파싱할 수 없습니다.", raw: text }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
      const raw = JSON.parse(jsonMatch[0]) as Array<{ title: string; subtitles: string[] } | string>;

      // Normalize: handle both new {title, subtitles} and legacy string[] formats
      const suggestions = raw.map((item) => ({
        title: typeof item === "string" ? item : item.title,
        subtitles: typeof item === "string" ? [] : (Array.isArray(item.subtitles) ? item.subtitles : []),
      }));

      return new Response(JSON.stringify({ suggestions }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "제목 생성 결과를 파싱할 수 없습니다.", raw: text }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: formatGeminiError(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

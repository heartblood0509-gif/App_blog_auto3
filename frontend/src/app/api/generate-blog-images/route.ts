import { getGeminiClient, formatGeminiError, withRetry } from "@/lib/gemini";
import { buildBlogImagePrompt } from "@/lib/prompts";
import type { BlogImageRatio } from "@/lib/prompts";
import { Modality } from "@google/genai";
import { rateLimit, getClientId, rateLimitResponse } from "@/lib/rate-limit";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { success } = rateLimit(getClientId(request), 10, 60_000);
  if (!success) return rateLimitResponse();

  try {
    const body = await request.json();
    const { descriptions, blogContent, ratio = "16:9" } = body as {
      descriptions: string[];
      blogContent: string;
      ratio: BlogImageRatio;
    };

    if (!descriptions || !Array.isArray(descriptions) || descriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: "이미지 설명이 필요합니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const clientApiKey = request.headers.get("x-api-key") || undefined;
    const client = getGeminiClient(clientApiKey);

    const images: { index: number; data: string; mimeType: string; description: string }[] = [];

    // Stream progress via SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < descriptions.length; i++) {
          const desc = descriptions[i];

          // Send progress event
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "progress", current: i + 1, total: descriptions.length, description: desc })}\n\n`)
          );

          try {
            const prompt = buildBlogImagePrompt(desc, blogContent, i, ratio);

            const response = await withRetry(() =>
              client.models.generateContent({
                model: "gemini-3.1-flash-image-preview",
                contents: prompt,
                config: {
                  responseModalities: [Modality.TEXT, Modality.IMAGE],
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  imageConfig: { aspectRatio: ratio as any },
                },
              })
            );

            const candidates = response.candidates;
            if (candidates && candidates.length > 0) {
              const parts = candidates[0].content?.parts;
              if (parts) {
                for (const part of parts) {
                  if (part.inlineData) {
                    const imageData = {
                      index: i,
                      data: part.inlineData.data || "",
                      mimeType: part.inlineData.mimeType || "image/png",
                      description: desc,
                    };
                    images.push(imageData);

                    // Send image result
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ type: "image", ...imageData })}\n\n`)
                    );
                    break;
                  }
                }
              }
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);

            if (msg.includes("SAFETY") || msg.includes("safety")) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "error", index: i, description: desc, error: "안전 필터에 의해 이미지가 차단되었습니다." })}\n\n`)
              );
            } else {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "error", index: i, description: desc, error: formatGeminiError(error) })}\n\n`)
              );
            }
          }

          // Rate limit: wait 3 seconds between requests
          if (i < descriptions.length - 1) {
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        // Send completion event
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done", total: images.length })}\n\n`)
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = formatGeminiError(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

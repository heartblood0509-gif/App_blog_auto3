import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";
import { decodeResponse } from "./encoding";

const CONTENT_SELECTORS = [
  "article",
  "main",
  ".post-content",
  ".entry-content",
  ".article-content",
  ".content",
  '[role="main"]',
  "#content",
];

const TITLE_SELECTORS = [
  "h1.entry-title",
  "h1.post-title",
  "h1.article-title",
  "article h1",
  "main h1",
  "h1",
];

export async function crawlGeneral(url: string): Promise<CrawlResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: 페이지를 불러올 수 없습니다.`);
  }

  const html = await decodeResponse(response);
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $(
    "script, style, nav, header, footer, .sidebar, .comments, .advertisement, .ad, iframe"
  ).remove();

  // Extract title
  let title = "";
  for (const selector of TITLE_SELECTORS) {
    const el = $(selector).first();
    if (el.length) {
      title = el.text().trim();
      break;
    }
  }
  if (!title) {
    title = $("title").text().trim();
  }

  // Extract content
  let content = "";
  for (const selector of CONTENT_SELECTORS) {
    const el = $(selector).first();
    if (el.length) {
      content = extractText($, el);
      if (content.length > 100) break;
    }
  }

  // Fallback: collect all paragraphs
  if (content.length < 100) {
    const paragraphs: string[] = [];
    $("p").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 20) {
        paragraphs.push(text);
      }
    });
    content = paragraphs.join("\n\n");
  }

  if (!content) {
    throw new Error("페이지에서 콘텐츠를 추출할 수 없습니다.");
  }

  return { title, content, platform: "general" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText($: cheerio.CheerioAPI, el: any): string {
  const blocks: string[] = [];

  el.find("h1, h2, h3, h4, h5, h6, p, li, blockquote, pre").each(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_: number, child: any) => {
      const tag = child.tagName?.toLowerCase();
      const text = $(child).text().trim();
      if (!text) return;

      if (tag?.startsWith("h")) {
        const level = parseInt(tag[1]);
        blocks.push(`${"#".repeat(level)} ${text}`);
      } else if (tag === "li") {
        blocks.push(`- ${text}`);
      } else if (tag === "blockquote") {
        blocks.push(`> ${text}`);
      } else {
        blocks.push(text);
      }
    }
  );

  return blocks.join("\n\n");
}

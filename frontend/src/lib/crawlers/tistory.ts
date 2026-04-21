import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";
import { decodeResponse } from "./encoding";

const CONTENT_SELECTORS = [
  ".contents_style",
  ".entry-content",
  ".article-view",
  "#article-view",
  ".post-content",
  "article",
];

const TITLE_SELECTORS = [
  ".tit_post",
  ".entry-title",
  "h1.title",
  ".post-title",
  "article h1",
  "h1",
];

export async function crawlTistory(url: string): Promise<CrawlResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: 티스토리 페이지를 불러올 수 없습니다.`);
  }

  const html = await decodeResponse(response);
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $(
    "script, style, nav, .sidebar, .comments, .another_category, .container_postbtn, .revenue_unit_wrap"
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
      content = extractTistoryText($, el);
      if (content.length > 100) break;
    }
  }

  if (!content) {
    throw new Error("티스토리 글에서 콘텐츠를 추출할 수 없습니다.");
  }

  return { title, content, platform: "tistory" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTistoryText($: cheerio.CheerioAPI, el: any): string {
  const blocks: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el.find("h1, h2, h3, h4, p, li, blockquote, div, span").each((_: number, child: any) => {
    const $child = $(child);
    const tag = child.tagName?.toLowerCase();
    const text = $child.text().trim();
    if (!text) return;

    // Skip if this element has child block elements (avoid duplicates)
    if (
      tag === "div" &&
      $child.find("p, h1, h2, h3, h4, li, blockquote").length > 0
    ) {
      return;
    }

    if (tag?.startsWith("h")) {
      const level = parseInt(tag[1]);
      blocks.push(`${"#".repeat(level)} ${text}`);
    } else if (tag === "li") {
      blocks.push(`- ${text}`);
    } else if (tag === "blockquote") {
      blocks.push(`> ${text}`);
    } else if (text.length > 5) {
      blocks.push(text);
    }
  });

  // Deduplicate consecutive identical lines
  const deduped: string[] = [];
  for (const block of blocks) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== block) {
      deduped.push(block);
    }
  }

  return deduped.join("\n\n");
}

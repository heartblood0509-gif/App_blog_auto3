import * as cheerio from "cheerio";
import type { CrawlResult } from "@/types";
import { decodeResponse } from "./encoding";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
};

export async function crawlNaver(url: string): Promise<CrawlResult> {
  return crawlNaverBlog(url);
}

// --- Naver Blog (fetch-based, no Playwright) ---

function parseNaverBlogUrl(
  url: string
): { blogId: string; logNo: string } | null {
  const parsed = new URL(url);

  // Pattern: /PostView.naver?blogId=xxx&logNo=yyy
  const blogIdParam = parsed.searchParams.get("blogId");
  const logNoParam = parsed.searchParams.get("logNo");
  if (blogIdParam && logNoParam) {
    return { blogId: blogIdParam, logNo: logNoParam };
  }

  // Pattern: /username/123456
  const pathMatch = parsed.pathname.match(/^\/([^/]+)\/(\d+)$/);
  if (pathMatch) {
    return { blogId: pathMatch[1], logNo: pathMatch[2] };
  }

  return null;
}

async function crawlNaverBlog(url: string): Promise<CrawlResult> {
  const params = parseNaverBlogUrl(url);
  if (!params) {
    throw new Error(
      "네이버 블로그 URL 형식을 인식할 수 없습니다. (예: blog.naver.com/아이디/글번호)"
    );
  }

  // Fetch blog post content directly (bypasses iframe)
  const postUrl = `https://blog.naver.com/PostView.naver?blogId=${params.blogId}&logNo=${params.logNo}&directAccess=true`;

  const response = await fetch(postUrl, { headers: FETCH_HEADERS });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: 네이버 블로그를 불러올 수 없습니다.`
    );
  }

  const html = await decodeResponse(response);
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $("script, style, .se-oglink-container, .se-section-oglink").remove();

  // Extract title
  let title = "";
  const titleSelectors = [
    ".se-title-text",
    ".pcol1 .itemSubjectBoldfont",
    ".se_title .se_textView",
    "h3.se_textarea",
    ".tit_h3",
  ];
  for (const sel of titleSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim()) {
      title = el.text().trim();
      break;
    }
  }
  if (!title) {
    title = $("title").text().trim();
  }

  // Extract content
  let content = "";
  const contentSelectors = [
    ".se-main-container",
    "#postViewArea",
    ".se_component_wrap",
  ];
  for (const sel of contentSelectors) {
    const el = $(sel).first();
    if (el.length) {
      content = extractNaverText($, el);
      if (content.length > 100) break;
    }
  }

  // Fallback: try all paragraphs
  if (content.length < 100) {
    const paragraphs: string[] = [];
    $("p, .se-text-paragraph").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 5) paragraphs.push(text);
    });
    if (paragraphs.join("\n\n").length > content.length) {
      content = paragraphs.join("\n\n");
    }
  }

  if (!content || content.length < 50) {
    throw new Error(
      "네이버 블로그에서 콘텐츠를 추출할 수 없습니다. 비공개 글이거나 접근이 제한된 글일 수 있습니다."
    );
  }

  return { title, content, platform: "naver" };
}

// --- Shared text extraction ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNaverText($: cheerio.CheerioAPI, el: any): string {
  const blocks: string[] = [];

  el.find(
    "h2, h3, h4, p, li, span.se-text-paragraph, div.se-text-paragraph, blockquote"
  ).each(
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
      } else if (text.length > 2) {
        blocks.push(text);
      }
    }
  );

  // Deduplicate consecutive lines
  const deduped: string[] = [];
  for (const block of blocks) {
    if (deduped.length === 0 || deduped[deduped.length - 1] !== block) {
      deduped.push(block);
    }
  }

  return deduped.join("\n\n");
}

import type { CrawlResult } from "@/types";
import { crawlNaver } from "./naver";
import { crawlTistory } from "./tistory";
import { crawlGeneral } from "./general";

export type Platform = "naver" | "tistory" | "general";

export function detectPlatform(url: string): Platform {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (
      hostname.includes("blog.naver.com") ||
      hostname.includes("m.blog.naver.com") ||
      hostname.includes("post.naver.com")
    ) {
      return "naver";
    }

    if (hostname.includes("tistory.com")) {
      return "tistory";
    }

    return "general";
  } catch {
    return "general";
  }
}

export async function crawlUrl(url: string): Promise<CrawlResult> {
  // 네이버 카페는 로그인 필수라 크롤링 불가 → 안내 메시지
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("cafe.naver.com")) {
      throw new Error(
        "네이버 카페는 로그인이 필요하여 자동 크롤링이 불가능합니다. 카페 게시글의 본문을 직접 복사하여 아래 텍스트 입력란에 붙여넣어 주세요."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("네이버 카페")) throw e;
  }

  const platform = detectPlatform(url);

  switch (platform) {
    case "naver":
      return crawlNaver(url);
    case "tistory":
      return crawlTistory(url);
    case "general":
      return crawlGeneral(url);
  }
}

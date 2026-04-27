/**
 * AI가 본문 끝에 자기검증/메타 정보를 출력하는 경우를 잘라내는 후처리.
 *
 * 프롬프트로 1차 방어를 걸어두지만, Gemini가 가끔 무시하므로
 * 여기서 패턴 기반 2차 방어를 적용한다.
 *
 * 잘라내는 기준: 아래 패턴 중 가장 먼저 등장하는 위치부터 끝까지 제거.
 */

const CUT_PATTERNS: RegExp[] = [
  /\n+\s*글자\s*수\s*및\s*키워드\s*확인\s*[:：]/,
  /\n+\s*글자\s*수\s*확인\s*[:：]/,
  /\n+\s*키워드\s*밀도\s*확인\s*[:：]/,
  /\n+\s*키워드\s*밀도\s*및.*확인\s*[:：]/,
  /\n+\s*이미지\s*삽입\s*확인\s*[:：]/,
  /\n+\s*이미지\s*마커\s*확인\s*[:：]/,
  /\n+\s*규칙\s*준수\s*확인\s*[:：]/,
  /\n+\s*체크리스트\s*[:：]/,
  /\n+\s*검토\s*[:：]/,
  /\n+\s*자체\s*검증\s*[:：]/,
  /\n+\s*분석\s*결과\s*[:：]/,
  /\n+#{1,6}\s*검증\b/,
  /\n+#{1,6}\s*체크리스트\b/,
  /\n+\s*Verification\s*[:：]/i,
  /\n+\s*Checklist\s*[:：]/i,
];

export function sanitizeGeneratedContent(text: string): string {
  if (!text) return text;

  let earliestIndex = text.length;
  for (const pattern of CUT_PATTERNS) {
    const match = text.match(pattern);
    if (match && match.index !== undefined && match.index < earliestIndex) {
      earliestIndex = match.index;
    }
  }

  return text.slice(0, earliestIndex).trimEnd();
}

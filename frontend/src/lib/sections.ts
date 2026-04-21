export interface Section {
  index: number;
  heading: string;
  content: string;
}

/**
 * 마크다운을 H2(##) 기준으로 섹션 분할
 * - index 0: 첫 H2 이전 (도입부/H1 제목)
 * - index 1~N: 각 H2 소제목 블록
 */
export function splitIntoSections(markdown: string): Section[] {
  const sections: Section[] = [];
  // \n## 로 분할하되, 첫 줄이 ## 로 시작하는 경우도 처리
  const parts = markdown.split(/(?=\n## )/);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const headingMatch = part.match(/^(?:\n)?## (.+)/);
    sections.push({
      index: i,
      heading: headingMatch ? headingMatch[1].trim() : i === 0 ? "도입부" : `섹션 ${i}`,
      content: part,
    });
  }

  return sections;
}

/**
 * 특정 섹션의 content를 교체한 후 전체 마크다운 재조립
 */
export function replaceSectionContent(
  markdown: string,
  sectionIndex: number,
  newContent: string
): string {
  const sections = splitIntoSections(markdown);
  if (sectionIndex < 0 || sectionIndex >= sections.length) return markdown;
  sections[sectionIndex].content = newContent;
  return sections.map((s) => s.content).join("");
}

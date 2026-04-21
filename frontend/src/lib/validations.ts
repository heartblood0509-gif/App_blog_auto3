import { z } from "zod";

export const crawlSchema = z.object({
  url: z.string().url("유효한 URL을 입력해주세요."),
});

export const analyzeSchema = z.object({
  referenceText: z
    .string()
    .min(50, "분석할 텍스트는 최소 50자 이상이어야 합니다."),
  projectId: z.string().optional(),
});

export const titleSchema = z.object({
  analysisResult: z.string().min(1, "분석 결과가 필요합니다."),
  topic: z.string().min(1, "주제를 입력해주세요."),
  keywords: z.string().min(1, "키워드를 입력해주세요."),
});

export const generateSchema = z.object({
  analysisResult: z.string().min(1, "분석 결과가 필요합니다."),
  referenceText: z.string().min(1, "레퍼런스 텍스트가 필요합니다."),
  topic: z.string().min(1, "주제를 입력해주세요."),
  keywords: z.string().min(1, "키워드를 입력해주세요."),
  selectedTitle: z.string().optional(),
  persona: z.string().optional(),
  productName: z.string().optional(),
  productAdvantages: z.string().optional(),
  productLink: z.string().optional(),
  requirements: z.string().optional(),
  charCountRange: z.string().optional(),
  includeImageDesc: z.boolean().optional(),
  subtitles: z.array(z.string()).optional(),
  projectId: z.string().optional(),
});

export const convertSchema = z.object({
  blogContent: z.string().min(1, "변환할 블로그 글이 필요합니다."),
  format: z.enum(["youtube-longform", "youtube-shortform", "instagram", "threads"]),
});

export const resizeSchema = z.object({
  blogContent: z.string().min(1, "조절할 블로그 글이 필요합니다."),
  targetCharCount: z.number().min(100, "최소 100자 이상이어야 합니다."),
  currentCharCount: z.number().min(1),
});

export const editSectionSchema = z.object({
  fullContent: z.string().min(1, "블로그 글이 필요합니다."),
  sectionContent: z.string().min(1, "수정할 구간이 필요합니다."),
  sectionIndex: z.number().min(0),
  instruction: z.string().min(1, "수정 지시사항을 입력해주세요."),
});

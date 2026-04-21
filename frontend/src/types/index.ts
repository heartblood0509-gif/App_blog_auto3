export interface BlogProject {
  id: string;
  created_at: string;
  updated_at: string;
  reference_url: string | null;
  reference_text: string | null;
  analysis_result: string | null;
  topic: string | null;
  keywords: string | null;
  requirements: string | null;
  generated_content: string | null;
  status: ProjectStatus;
  tags: string[] | null;
  title: string | null;
}

export type ProjectStatus =
  | "draft"
  | "analyzing"
  | "analyzed"
  | "generating"
  | "completed"
  | "error";

export interface CrawlResult {
  title: string;
  content: string;
  platform: string;
}

export interface CrawlRequest {
  url: string;
}

export interface AnalyzeRequest {
  referenceText: string;
  projectId?: string;
}

export interface GenerateRequest {
  analysisResult: string;
  referenceText: string;
  topic: string;
  keywords: string;
  requirements?: string;
  projectId?: string;
}

// ─── 네이버 발행 관련 타입 ─────────────────────────────

export interface PublishImage {
  index: number;
  data: string;
  mimeType: string;
  description: string;
}

export interface FormattingTheme {
  name: string;
  accent_color: string;
  heading_quote_style: string;
  body_quote_style: string;
}

export interface PublishRequest {
  content_md: string;
  images: PublishImage[];
  title: string;
  keyword: string;
  naver_account_id: string;
  formatting_theme: FormattingTheme;
  auto_publish: boolean;
}

export interface PublishProgress {
  step: string;
  progress: number;
  message: string;
  detail?: string;
  url?: string;
}

export interface ForbiddenCheckResult {
  forbidden_words: {
    word: string;
    line: number;
    suggestion: string | null;
    category: string;
  }[];
  keyword_density: {
    density: number;
    count: number;
    total_chars: number;
    is_valid: boolean;
  } | null;
  cliche_count: number;
  cliches: { word: string; line: number }[];
  has_critical_violations: boolean;
  summary: string;
}

export interface NaverAccount {
  id: string;
  username: string;
  nickname: string;
  blog_id: string;
  is_active: boolean;
  last_post_at: string | null;
}

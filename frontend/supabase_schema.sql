-- Blog Writer 프로젝트 테이블
-- Supabase SQL Editor에서 실행해주세요

CREATE TABLE IF NOT EXISTS blog_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- 레퍼런스 정보
    reference_url TEXT,
    reference_text TEXT,

    -- 분석 결과
    analysis_result TEXT,

    -- 생성 정보
    topic TEXT,
    keywords TEXT,
    requirements TEXT,
    generated_content TEXT,

    -- 메타데이터
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'analyzing', 'analyzed', 'generating', 'completed', 'error')),
    tags TEXT[],
    title TEXT
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_blog_projects_created_at ON blog_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_projects_status ON blog_projects(status);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_blog_projects_updated_at ON blog_projects;
CREATE TRIGGER update_blog_projects_updated_at
    BEFORE UPDATE ON blog_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (인증 없이 공개 접근)
ALTER TABLE blog_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON blog_projects FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON blog_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON blog_projects FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON blog_projects FOR DELETE USING (true);

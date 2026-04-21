# App_Blog (Blog Pick) — 프로젝트 컨텍스트

Next.js 16 기반 블로그·쓰레드 자동 생성 SaaS. 사용자는 비개발자이며, 커스텀이 쉬운 도구를 선호함.

## 작업 환경

- 두 개의 Vercel 배포가 동시 운영됨
  - 내부용: https://blogapp-five-omega.vercel.app (`NEXT_PUBLIC_APP_MODE=company`)
  - 외부용: https://blogpick.vercel.app (`NEXT_PUBLIC_APP_MODE=user`)
- 같은 GitHub 레포(heartblood0509-gif/App_Blog), 같은 코드, env만 다름
- 핵심 차이: 사용자 본인 Gemini API 키 입력 여부 + 로그인 필요 여부

## 핵심 파일 (수정 빈도 높은 순)

- [src/lib/prompts.ts](src/lib/prompts.ts) — 모든 LLM 프롬프트 (831줄)
- [src/lib/templates.ts](src/lib/templates.ts) — 내장 템플릿 7종 (블로그 4 + 쓰레드 3)
- [src/lib/crawlers/](src/lib/crawlers/) — 네이버/티스토리/일반 크롤러
- [src/components/project/step-*.tsx](src/components/project/) — 단계별 UI

## 연관 스킬

- `~/my-skills/blog-pick/` — Blog Pick의 클로드 코드 버전 (대화형 + 일괄 모드)
  - `SKILL.md` (498줄) + `references/` 6개
  - 사용자가 "블로그 써줘" / "쓰레드 써줘" / "블로그 N개 한꺼번에" 발화로 트리거
- 기존 `~/my-skills/blog-write/`, `~/my-skills/thread-write/`는 1~2주 공존 후 archive 예정

## 진행 중 작업 (다음 세션에서 이어질 가능성 높음)

**SuperNaverBot 매크로 영상 분석 → 자동 발행 기능 추가**

- 사용자가 유튜브 매크로 도구(SuperNaverBot) 시연 영상 캡처를 제공함
- 해당 도구의 기술 스택을 1차 출처(영상 캡처)로 분석 완료
- 사용자의 마지막 질문에 "만들 수 있다"고 확답함
- 상세 분석은 auto memory에 저장됨: `supernaverbot_analysis.md`
- 다음 세션에서 사용자가 "비슷한 거 만들어줘", "자동 발행 추가해줘", "SuperNaverBot 같은 거" 같은 요청을 하면 그 메모리부터 읽고 시작

**작업 출발점**: sinmb79/blog-writer (MIT, ⭐101) 코드 + Blog Pick 통합. 약 2~3주 작업.

## 작업 원칙 (사용자 피드백 누적)

- **공식 문서 1차 출처 우선**: 외부 사실 주장은 반드시 WebFetch/WebSearch로 검증. 추측·추정 금지.
- **비개발자 친화 답변**: 단축키·복잡한 명령 대신 클릭 한 번으로 가능한 방법 제시.
- **결정형 답변 선호**: 사용자가 "그래서 가능해 안 가능해"처럼 직답을 요청하면 부연 없이 한 줄로.
- **솔직한 한계 인정**: 매크로·자동화의 위험성, 검색 누락 가능성 등을 광고에 휩쓸리지 않고 정직하게 말함.

## 메모리·플랜 위치

- Auto memory: `~/.claude/projects/-Users-yunseojun-AI-project-App-Blog/memory/`
- Plan 파일: `~/.claude/plans/`
- 글로벌 사용자 지침: `~/.claude/CLAUDE.md`

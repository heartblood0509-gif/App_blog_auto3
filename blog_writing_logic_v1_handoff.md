# 블로그 글쓰기 로직 v1 핸드오프 (다른 프로젝트 이식용)

> **이 파일 하나로 끝.** 다른 프로젝트의 클로드 코드에 이 파일을 통째로 주면, 동일한 블로그 글쓰기 파이프라인을 만들어줄 수 있다.

---

## 🎯 통합 가이드 (받는 쪽 클로드 코드에게)

이 문서는 검증된 블로그 글쓰기 파이프라인을 다른 프로젝트에 이식하기 위한 자료. 핵심 3요소:

1. **분석 프롬프트** — 레퍼런스 블로그 글에서 **사실만 추출**
2. **옵션 병합 로직** — UI 옵션을 한 줄로 합치기
3. **생성 프롬프트** — 분석 결과를 따라 새 글 작성

받는 프로젝트의 기존 LLM 호출 코드에 이 3개를 주입하면 된다. UI는 어떤 형태든 상관없음.

### 작동 흐름

```
[사용자 레퍼런스 글] + [주제·키워드·옵션]
       ↓
[분석 프롬프트] → Gemini 2.5 Flash → "분석 결과" (마크다운 텍스트)
       ↓
[옵션 병합] → "추가 요구사항" 한 줄로 합쳐짐
       ↓
[생성 프롬프트] → Gemini 2.5 Flash (스트리밍) → 블로그 본문 (마크다운)
```

---

## 1️⃣ 분석 프롬프트

**역할**: 레퍼런스 글에서 16개 항목 사실 추출. 카테고리 분류·서사 분해·해석 일절 안 함.

**입력**: `referenceText` (string)
**모델**: `gemini-2.5-flash` (스트리밍)
**출력**: 마크다운 분석 보고서

### 프롬프트 본문 (그대로 사용)

```text
다음 블로그 글을 분석하여 구조와 특징을 추출해주세요.

---
{referenceText}
---

다음 항목들을 상세하게 분석해주세요:

## 📝 글 구조 분석
1. **제목 패턴 및 스타일**: 제목의 구조, 키워드 배치, 길이 등
2. **서론 구성 방식**: 첫 문단의 시작 방식, 독자 유인 기법 등
3. **본론 섹션 구조**: 섹션 수, 각 섹션의 구성, 전개 방식
4. **소제목 스타일과 패턴**: 소제목 형식, 번호 사용 여부 등
5. **문단 길이와 구성**: 평균 문단 길이, 문장 수 등
6. **결론 방식**: 마무리 패턴, CTA(행동 유도) 여부 등
7. **문체 특징**: 이모지 사용, 구어체/문어체, 특수 표현 등
8. **전체적인 톤 앤 매너**: 글의 분위기, 전문성 수준, 타겟 독자층 등

## 🔍 SEO 상위노출 분석
9. **총 글자 수**: 공백 포함/제외 글자 수를 정확히 세서 알려주세요. 블로그 상위노출에 적합한 분량인지도 평가해주세요.
10. **핵심 키워드 분석**: 본문에서 반복적으로 등장하는 키워드 목록과 각 등장 횟수, 키워드 밀도(%)를 표로 정리해주세요.
11. **제목 내 키워드**: 제목에 포함된 핵심 키워드와 SEO 관점에서의 적합성
12. **소제목(H2/H3) 키워드 포함 여부**: 소제목에 키워드가 자연스럽게 포함되어 있는지
13. **이미지/사진 삽입 분석**: 이미지가 삽입된 것으로 추정되는 위치와 예상 개수, 이미지 간격 패턴. 상위노출에 적합한 이미지 수인지 평가
14. **내부/외부 링크 사용**: 링크 사용 여부와 패턴
15. **글 도입부 키워드 배치**: 첫 100자 내에 핵심 키워드가 포함되어 있는지
16. **SEO 종합 점수 및 평가**: 이 글의 검색 상위노출 가능성을 100점 만점으로 평가하고, 개선 포인트를 구체적으로 요약

결과를 마크다운 형식으로 정리해주세요.
```

---

## 2️⃣ 옵션 병합 로직

**역할**: 사용자 UI 옵션 8종을 **한 줄의 "추가 요구사항"** 으로 합쳐서 생성 프롬프트에 주입.

### 변환 규칙

| 옵션 | 변환 결과 |
|------|----------|
| `selectedTitle` | `제목은 "{X}"로 H1 작성` |
| `persona` | `글쓴이 페르소나: {X}` |
| `productName` | `제품명을 자연스럽게 1~2회 언급: {X}` |
| `productAdvantages` (productName 있을 때) | 위 끝에 ` (장점 참고: {Y})` 덧붙임 |
| `productLink` | `구매 링크는 글 맨 마지막에 단독 한 줄: {URL}` |
| `charCountRange = "500-1500"` | `목표 분량은 공백 제외 500~1,500자` |
| `charCountRange = "1500-2500"` | `목표 분량은 공백 제외 1,500~2,500자` |
| `charCountRange = "2500-3500"` | `목표 분량은 공백 제외 2,500~3,500자` |
| `requirements` | 사용자 자유입력 그대로 |

### 결합 방식
- 위 결과들을 ` / ` 로 이어붙임
- 결과를 `\n- **추가 요구사항**: {결합된 문자열}` 형태로 한 줄로 만듦
- **옵션이 하나도 없으면 빈 문자열 반환** (라인 자체 생략)

### TypeScript 참고 코드

```ts
function buildRequirementsLine(options?: {
  selectedTitle?: string;
  persona?: string;
  productName?: string;
  productAdvantages?: string;
  productLink?: string;
  requirements?: string;
  charCountRange?: string;
}): string {
  const enrichments: string[] = [];

  if (options?.selectedTitle) {
    enrichments.push(`제목은 "${options.selectedTitle}"로 H1 작성`);
  }
  if (options?.persona) {
    enrichments.push(`글쓴이 페르소나: ${options.persona}`);
  }
  if (options?.productName) {
    let line = `제품명을 자연스럽게 1~2회 언급: ${options.productName}`;
    if (options.productAdvantages) {
      line += ` (장점 참고: ${options.productAdvantages})`;
    }
    enrichments.push(line);
  }
  if (options?.productLink) {
    enrichments.push(`구매 링크는 글 맨 마지막에 단독 한 줄: ${options.productLink}`);
  }
  const charLabel: Record<string, string> = {
    "500-1500": "500~1,500자",
    "1500-2500": "1,500~2,500자",
    "2500-3500": "2,500~3,500자",
  };
  if (options?.charCountRange && charLabel[options.charCountRange]) {
    enrichments.push(`목표 분량은 공백 제외 ${charLabel[options.charCountRange]}`);
  }
  if (options?.requirements) {
    enrichments.push(options.requirements);
  }

  return enrichments.length > 0
    ? `\n- **추가 요구사항**: ${enrichments.join(" / ")}`
    : "";
}
```

### Python 참고 코드

```python
def build_requirements_line(
    selected_title: str = "",
    persona: str = "",
    product_name: str = "",
    product_advantages: str = "",
    product_link: str = "",
    requirements: str = "",
    char_count_range: str = "",
) -> str:
    enrichments = []

    if selected_title:
        enrichments.append(f'제목은 "{selected_title}"로 H1 작성')
    if persona:
        enrichments.append(f"글쓴이 페르소나: {persona}")
    if product_name:
        line = f"제품명을 자연스럽게 1~2회 언급: {product_name}"
        if product_advantages:
            line += f" (장점 참고: {product_advantages})"
        enrichments.append(line)
    if product_link:
        enrichments.append(f"구매 링크는 글 맨 마지막에 단독 한 줄: {product_link}")
    char_label = {
        "500-1500": "500~1,500자",
        "1500-2500": "1,500~2,500자",
        "2500-3500": "2,500~3,500자",
    }
    if char_count_range in char_label:
        enrichments.append(f"목표 분량은 공백 제외 {char_label[char_count_range]}")
    if requirements:
        enrichments.append(requirements)

    if not enrichments:
        return ""
    return f"\n- **추가 요구사항**: {' / '.join(enrichments)}"
```

---

## 3️⃣ 생성 프롬프트

**역할**: 분석 결과 + 사용자 입력 → 새 블로그 본문.

**입력**: `analysisResult` (분석 프롬프트 출력), `topic`, `keywords`, `requirementsLine` (옵션 병합 결과), `imageInstruction`
**모델**: `gemini-2.5-flash` (스트리밍)
**출력**: 마크다운 본문 (H1부터 결말까지)

### 프롬프트 본문 (그대로 사용)

```text
당신은 브랜드 블로그 콘텐츠 작성 전문가입니다.

## 레퍼런스 분석 결과
{analysisResult}

## 작성 요청
- **주제**: {topic}
- **키워드**: {keywords}{requirementsLine}

## 작성 지침
위 분석 결과의 **구조와 스타일만** 참고하여 완전히 새로운 블로그 글을 작성해주세요.

⚠️ **절대 금지 사항:**
- 레퍼런스 글의 문장을 그대로 복사하거나 살짝 바꿔 쓰는 것
- 레퍼런스의 구체적 사례나 예시를 그대로 가져오는 것

✅ **반드시 지킬 사항:**
- 구조와 형식만 참고하고, 내용은 100% 새로 작성
- 지정된 키워드를 자연스럽게 포함
- 분석된 톤 앤 매너를 유지
- 마크다운 형식으로 작성
- 분석된 문단 길이와 섹션 구조를 따를 것
- **레퍼런스와 비슷한 글자 수(공백 제외)로 작성할 것** - 분석 결과의 총 글자 수를 참고하여 유사한 분량을 맞춰주세요
- SEO 최적화: 키워드를 제목, 소제목, 도입부 100자 이내에 자연스럽게 배치
- SEO 최적화: 키워드 밀도 1~3%를 유지하도록 본문 전체에 고르게 분산
{imageInstruction}
```

### `imageInstruction` 분기 (사용자가 이미지 마커를 원하는지 토글)

```text
includeImageDesc 가 false 면:
"- 이미지 관련 표시는 아무것도 넣지 마세요"

그 외엔 (기본값):
"- 이미지 삽입 위치를 [이미지: 설명] 형태로 표시해주세요 (레퍼런스의 이미지 패턴 참고)"
```

---

## 🤖 모델 설정

```
분석 프롬프트  → gemini-2.5-flash  (스트리밍)
생성 프롬프트  → gemini-2.5-flash  (스트리밍)
```

**Flash 고정 이유**: 단순 사실 추출 + 모방형 작문엔 Flash가 정답. Pro는 똑똑해서 분석을 카테고리화하거나 글을 재해석하는 등 **과한 해석**을 함 → 레퍼런스 충실도가 떨어짐. Flash는 시키는 대로만 해서 결과가 더 좋음.

---

## 🐍 Python + Gemini 풀 사용 예시

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel("gemini-2.5-flash")

# === 1단계: 분석 ===
def build_analysis_prompt(reference_text: str) -> str:
    return f"""다음 블로그 글을 분석하여 구조와 특징을 추출해주세요.

---
{reference_text}
---

다음 항목들을 상세하게 분석해주세요:

## 📝 글 구조 분석
1. **제목 패턴 및 스타일**: 제목의 구조, 키워드 배치, 길이 등
2. **서론 구성 방식**: 첫 문단의 시작 방식, 독자 유인 기법 등
3. **본론 섹션 구조**: 섹션 수, 각 섹션의 구성, 전개 방식
4. **소제목 스타일과 패턴**: 소제목 형식, 번호 사용 여부 등
5. **문단 길이와 구성**: 평균 문단 길이, 문장 수 등
6. **결론 방식**: 마무리 패턴, CTA(행동 유도) 여부 등
7. **문체 특징**: 이모지 사용, 구어체/문어체, 특수 표현 등
8. **전체적인 톤 앤 매너**: 글의 분위기, 전문성 수준, 타겟 독자층 등

## 🔍 SEO 상위노출 분석
9. **총 글자 수**: 공백 포함/제외 글자 수를 정확히 세서 알려주세요. 블로그 상위노출에 적합한 분량인지도 평가해주세요.
10. **핵심 키워드 분석**: 본문에서 반복적으로 등장하는 키워드 목록과 각 등장 횟수, 키워드 밀도(%)를 표로 정리해주세요.
11. **제목 내 키워드**: 제목에 포함된 핵심 키워드와 SEO 관점에서의 적합성
12. **소제목(H2/H3) 키워드 포함 여부**: 소제목에 키워드가 자연스럽게 포함되어 있는지
13. **이미지/사진 삽입 분석**: 이미지가 삽입된 것으로 추정되는 위치와 예상 개수, 이미지 간격 패턴. 상위노출에 적합한 이미지 수인지 평가
14. **내부/외부 링크 사용**: 링크 사용 여부와 패턴
15. **글 도입부 키워드 배치**: 첫 100자 내에 핵심 키워드가 포함되어 있는지
16. **SEO 종합 점수 및 평가**: 이 글의 검색 상위노출 가능성을 100점 만점으로 평가하고, 개선 포인트를 구체적으로 요약

결과를 마크다운 형식으로 정리해주세요."""


# === 2단계: 옵션 병합 ===
def build_requirements_line(**options) -> str:
    enrichments = []
    if options.get("selected_title"):
        enrichments.append(f'제목은 "{options["selected_title"]}"로 H1 작성')
    if options.get("persona"):
        enrichments.append(f"글쓴이 페르소나: {options['persona']}")
    if options.get("product_name"):
        line = f"제품명을 자연스럽게 1~2회 언급: {options['product_name']}"
        if options.get("product_advantages"):
            line += f" (장점 참고: {options['product_advantages']})"
        enrichments.append(line)
    if options.get("product_link"):
        enrichments.append(f"구매 링크는 글 맨 마지막에 단독 한 줄: {options['product_link']}")
    char_label = {
        "500-1500": "500~1,500자",
        "1500-2500": "1,500~2,500자",
        "2500-3500": "2,500~3,500자",
    }
    if options.get("char_count_range") in char_label:
        enrichments.append(f"목표 분량은 공백 제외 {char_label[options['char_count_range']]}")
    if options.get("requirements"):
        enrichments.append(options["requirements"])

    if not enrichments:
        return ""
    return f"\n- **추가 요구사항**: {' / '.join(enrichments)}"


# === 3단계: 생성 ===
def build_generation_prompt(
    analysis_result: str,
    topic: str,
    keywords: str,
    requirements_line: str = "",
    include_image_desc: bool = True,
) -> str:
    image_instruction = (
        "- 이미지 관련 표시는 아무것도 넣지 마세요"
        if not include_image_desc
        else "- 이미지 삽입 위치를 [이미지: 설명] 형태로 표시해주세요 (레퍼런스의 이미지 패턴 참고)"
    )

    return f"""당신은 브랜드 블로그 콘텐츠 작성 전문가입니다.

## 레퍼런스 분석 결과
{analysis_result}

## 작성 요청
- **주제**: {topic}
- **키워드**: {keywords}{requirements_line}

## 작성 지침
위 분석 결과의 **구조와 스타일만** 참고하여 완전히 새로운 블로그 글을 작성해주세요.

⚠️ **절대 금지 사항:**
- 레퍼런스 글의 문장을 그대로 복사하거나 살짝 바꿔 쓰는 것
- 레퍼런스의 구체적 사례나 예시를 그대로 가져오는 것

✅ **반드시 지킬 사항:**
- 구조와 형식만 참고하고, 내용은 100% 새로 작성
- 지정된 키워드를 자연스럽게 포함
- 분석된 톤 앤 매너를 유지
- 마크다운 형식으로 작성
- 분석된 문단 길이와 섹션 구조를 따를 것
- **레퍼런스와 비슷한 글자 수(공백 제외)로 작성할 것** - 분석 결과의 총 글자 수를 참고하여 유사한 분량을 맞춰주세요
- SEO 최적화: 키워드를 제목, 소제목, 도입부 100자 이내에 자연스럽게 배치
- SEO 최적화: 키워드 밀도 1~3%를 유지하도록 본문 전체에 고르게 분산
{image_instruction}"""


# === 사용 예 ===

# 1. 분석
analysis = model.generate_content(
    build_analysis_prompt(reference_text="...크롤링한 블로그 본문...")
).text

# 2. 옵션 병합
req_line = build_requirements_line(
    selected_title="환절기 두피 관리 진짜 답",
    persona="32살 남성 직장인, 탈모 고민 2년차",
    product_name="OO샴푸",
    product_advantages="귀리단백질 함유, 약산성",
    char_count_range="2500-3500",
)

# 3. 생성
prompt = build_generation_prompt(
    analysis_result=analysis,
    topic="환절기 두피 관리",
    keywords="두피 관리, 탈모 예방 샴푸",
    requirements_line=req_line,
    include_image_desc=True,
)
blog_content = model.generate_content(prompt).text
print(blog_content)
```

---

## ⚠️ 다른 프로젝트 적용 시 주의

1. **두 프롬프트는 한 쌍**: 분석 출력 형식을 바꾸면 생성 프롬프트가 못 읽음. 같이 다녀야 함.
2. **SEO 부분은 한국 블로그(특히 네이버) 기준**: 키워드 밀도 1~3%, 도입부 100자 키워드 등은 네이버용. 다른 플랫폼은 빼거나 교체.
3. **옵션은 무조건 한 줄에 몰아넣기**: 옵션마다 별도 섹션 만들면 AI 주의 분산됨.
4. **Flash 고정**: Pro 쓰면 결과 나빠짐. 시키는 대로만 하는 Flash가 정답.
5. **레퍼런스가 한국 블로그가 아니면 프롬프트 일부 한국어 표현 영문화 필요**.

---

## 🚀 핵심 한 줄

> **사실 추출 분석 + 단순 모방 생성 + Flash 모델** = 레퍼런스 충실도 높은 블로그 글의 정답.

작가 매뉴얼 만들지 말고, 30줄짜리 사실 보고서 + 34줄짜리 모방 명령에서 출발해라.

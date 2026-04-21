"""
네이버 블로그 자동 포스팅 — SmartEditor ONE 자동화

핵심: SmartEditor ONE은 mainFrame iframe 안에 있음.
모든 셀렉터 조작은 editor_frame에서 수행해야 함.

실제 검증된 셀렉터 (2026-04-10):
- 제목 placeholder: .se-placeholder.__se_placeholder
- 본문 영역: .se-component-content
- 본문 편집: .se-content
- 텍스트 입력: .se-text-paragraph
- 이미지 버튼: button[data-name="image"]
- 인용구 버튼: button[data-name="quotation"]
- 발행 버튼: .publish_btn__m9KHH (iframe 밖, 메인 페이지)
- 저장 버튼: .save_btn__bzc5B (iframe 밖, 메인 페이지)
"""

import asyncio
import random
from pathlib import Path
from playwright.async_api import Frame, Page

from core.markdown_converter import BlockType, parse_markdown, parse_emphasis


# 레퍼런스 블로그 분석 기반 색상 팔레트 (포스트별 랜덤 선택)
ACCENT_COLORS = [
    "rgb(255, 95, 69)",   # 주황빨강
    "rgb(0, 78, 130)",    # 진파랑
    "rgb(186, 0, 0)",     # 진빨강
    "rgb(130, 63, 0)",    # 갈색
    "rgb(187, 0, 92)",    # 진분홍
    "rgb(0, 120, 203)",   # 파랑
]


class NaverBlogPublisher:
    """네이버 블로그 자동 발행기"""

    def __init__(self, page: Page):
        self.page = page
        self.editor_frame: Frame | None = None
        self.accent_color: str = random.choice(ACCENT_COLORS)
        self.heading_quote_style: str = "default"  # 테마에서 설정
        self.body_quote_style: str = "default"      # 테마에서 설정

    def _get_editor_frame(self) -> Frame:
        """mainFrame iframe 찾기"""
        if self.editor_frame:
            return self.editor_frame
        for frame in self.page.frames:
            if "PostWrite" in frame.url or frame.name == "mainFrame":
                self.editor_frame = frame
                return frame
        raise RuntimeError("SmartEditor ONE iframe(mainFrame)을 찾을 수 없습니다.")

    async def _wait_for_editor_frame(self, timeout: int = 30) -> Frame:
        """에디터 iframe이 나타날 때까지 대기"""
        for i in range(timeout):
            for frame in self.page.frames:
                if "PostWrite" in frame.url or frame.name == "mainFrame":
                    self.editor_frame = frame
                    return frame
            await asyncio.sleep(1)
        raise RuntimeError("SmartEditor ONE iframe(mainFrame)을 찾을 수 없습니다.")

    async def _human_click(self, element):
        """요소 영역 내 랜덤 위치 클릭 (iframe 안에서도 안전)"""
        box = await element.bounding_box()
        if box:
            offset_x = random.uniform(box["width"] * 0.2, box["width"] * 0.8)
            offset_y = random.uniform(box["height"] * 0.25, box["height"] * 0.75)
            await element.click(position={"x": offset_x, "y": offset_y})
        else:
            await element.click()

    async def _human_type(self, text: str, delay_range: tuple[int, int] = (5, 15)):
        """인간형 타이핑"""
        for char in text:
            await self.page.keyboard.type(char, delay=random.randint(*delay_range))
            if random.random() < 0.08:
                await asyncio.sleep(random.uniform(0.05, 0.2))

    async def navigate_to_editor(self, blog_id: str) -> bool:
        """글쓰기 페이지로 이동 (로그인 리다이렉트 포함)"""
        write_url = f"https://blog.naver.com/{blog_id}?Redirect=Write"
        print(f"  [이동] → {write_url}")
        await self.page.goto(write_url, wait_until="domcontentloaded")
        await asyncio.sleep(3)

        # 로그인 리다이렉트 시 대기
        if "nidlogin" in self.page.url or "login" in self.page.url.lower():
            print("  [이동] 로그인 대기 중... (브라우저에서 로그인하세요)")
            for i in range(180):
                await asyncio.sleep(1)
                if "nidlogin" not in self.page.url and "login" not in self.page.url.lower():
                    print("  [이동] ✓ 로그인 완료")
                    break
                if (i + 1) % 30 == 0:
                    print(f"    ... {i + 1}초 경과")
            else:
                print("  [이동] ⚠ 로그인 타임아웃")
                return False

        await asyncio.sleep(5)

        # mainFrame iframe 확인
        try:
            frame = self._get_editor_frame()
            await frame.wait_for_selector(".se-content", timeout=15000)
            print(f"  [이동] ✓ SmartEditor ONE 로드 완료")
        except Exception as e:
            print(f"  [이동] ⚠ 에디터 로드 실패: {e}")
            return False

        # 팝업 닫기 (임시저장 복원 팝업 등)
        await self._dismiss_popups(frame)
        return True

    async def _dismiss_popups(self, frame: Frame, *, context: str = "이동") -> bool:
        """에디터 위에 떠있는 팝업 닫기 (임시저장 복원 등).

        "작성 중인 글이 있습니다" 다이얼로그의 경우 **취소(새 글로 시작)** 선택.
        iframe 내부와 외부 페이지 양쪽에서 탐색.
        반환값: 팝업을 하나라도 닫았으면 True.
        """
        await asyncio.sleep(0.5)
        closed_any = False

        # 취소(새 글로 시작) 우선 — 확인을 누르면 임시글이 복원돼 덮어쓰기 어려움
        cancel_selectors = [
            '.se-popup-alert-confirm button.se-popup-button-cancel',
            '.se-popup-alert button.se-popup-button-cancel',
            'button.se-popup-button-cancel',
            '.se-popup-container button:has-text("취소")',
            '.se-popup-alert button:has-text("취소")',
            'button:has-text("취소")',
            'button:has-text("아니오")',
            'button:has-text("아니요")',
        ]
        confirm_selectors = [
            '.se-popup-alert button:has-text("확인")',
            'button.se-popup-button-confirm',
            'button:has-text("확인")',
        ]
        close_selectors = [
            'button[aria-label="닫기"]',
            '.se-popup-close',
            '.popup_close',
        ]

        # iframe + 페이지 양쪽에서 같은 순서로 시도
        scopes = [("iframe", frame), ("page", self.page)]
        for scope_name, scope in scopes:
            for group_name, selectors in [
                ("cancel", cancel_selectors),
                ("close", close_selectors),
                ("confirm", confirm_selectors),
            ]:
                for sel in selectors:
                    try:
                        btn = await scope.query_selector(sel)
                        if btn and await btn.is_visible():
                            await btn.click()
                            print(f"  [{context}] 팝업 닫음 ({scope_name}/{group_name}: {sel[:50]})")
                            await asyncio.sleep(0.7)
                            closed_any = True
                            break
                    except Exception:
                        continue
                if closed_any:
                    break
            if closed_any:
                break

        # dim 레이어 남아있으면 클릭으로 닫기
        if not closed_any:
            try:
                dim = await frame.query_selector('.se-popup-dim')
                if dim and await dim.is_visible():
                    await dim.click()
                    print(f"  [{context}] 팝업 dim 클릭으로 닫음")
                    await asyncio.sleep(0.5)
                    closed_any = True
            except Exception:
                pass

        return closed_any

    async def publish(
        self,
        blog_id: str,
        content_md: str,
        image_paths: list[Path] | None = None,
        auto_publish: bool = False,
        formatting_theme: dict | None = None,
        progress_callback=None,
    ) -> str | None:
        """마크다운 콘텐츠를 네이버 블로그에 발행

        Args:
            blog_id: 네이버 블로그 아이디
            content_md: 마크다운 형식의 블로그 글
            image_paths: 삽입할 이미지 파일 경로 목록
            auto_publish: True면 자동 발행, False면 입력만 (수동 발행)
            formatting_theme: 포맷팅 테마 (accent_color 등)
            progress_callback: 진행 상태 콜백 (step, progress, message)

        Returns:
            발행된 글의 URL 또는 None
        """
        def _progress(step: str, progress: int, message: str):
            if progress_callback:
                progress_callback(step, progress, message)

        # 포맷팅 테마 적용
        if formatting_theme:
            if formatting_theme.get("accent_color"):
                self.accent_color = formatting_theme["accent_color"]
            if formatting_theme.get("heading_quote"):
                self.heading_quote_style = formatting_theme["heading_quote"]
            if formatting_theme.get("body_quote"):
                self.body_quote_style = formatting_theme["body_quote"]
            print(f"  🎨 테마: {formatting_theme.get('name', '?')} / 소제목: {self.heading_quote_style} / 인용: {self.body_quote_style} / 색상: {self.accent_color}")

        sequence = parse_markdown(content_md)
        image_paths = image_paths or []
        frame = self._get_editor_frame()

        print(f"\n[Blog] 포스팅 시작: {sequence.title[:40]}...")
        print(f"  블록: {len(sequence.blocks)}개, 이미지: {len(image_paths)}장")

        # 1. 제목 입력 (팝업이 뒤늦게 뜰 수 있으니 한 번 더 체크)
        print("  [1/4] 제목 입력 중...")
        _progress("title", 30, "제목 입력 중...")
        await self._dismiss_popups(frame, context="제목")
        await self._input_title(frame, sequence.title)

        # 2. 본문 입력
        print("  [2/4] 본문 입력 중...")
        _progress("body", 40, f"본문 입력 중... (0/{len(sequence.blocks)} 블록)")
        await self._dismiss_popups(frame, context="본문")
        await self._input_body(frame, sequence.blocks, image_paths)
        _progress("body", 75, f"본문 입력 완료 ({len(sequence.blocks)} 블록)")

        # 3. 발행 또는 대기
        if auto_publish:
            print("  [3/4] 발행 중...")
            _progress("publish", 90, "발행 중...")
            await self._dismiss_popups(frame, context="발행")
            url = await self._click_publish(frame)
            if url:
                print(f"  [4/4] ✓ 발행 완료: {url}")
                _progress("done", 100, f"발행 완료!")
            else:
                print("  [4/4] ⚠ 발행 결과 확인 불가")
                _progress("done", 100, "입력 완료 (발행 URL 확인 불가)")
            return url
        else:
            print("  [3/4] 입력 완료! 브라우저에서 확인 후 수동 발행하세요.")
            _progress("done", 100, "입력 완료! 브라우저에서 확인 후 수동 발행하세요.")
            print("  [4/4] 브라우저가 열린 상태로 유지됩니다.")
            return None

    async def _input_title(self, frame: Frame, title: str):
        """제목 입력 — 다중 셀렉터 + 포커스 초기화 + 실패 시 디버그 자료 저장"""
        from bots.login_debug import capture_failure

        # 혹시 포커스를 훔친 팝업/요소가 있으면 blur해서 떼어냄
        try:
            await frame.evaluate(
                "document.activeElement && document.activeElement.blur && document.activeElement.blur()"
            )
        except Exception:
            pass

        # 후보 셀렉터 — 먼저 뜨는 것을 사용
        candidates = [
            ".se-placeholder.__se_placeholder",
            ".se-documentTitle .se-placeholder",
            ".se-title-text .se-placeholder",
            ".se-documentTitle [contenteditable='true']",
            ".se-title-text",
        ]

        clicked = False
        last_err: Exception | None = None
        for sel in candidates:
            try:
                el = await frame.wait_for_selector(sel, timeout=5000)
                if el:
                    await self._human_click(el)
                    await asyncio.sleep(0.4)
                    clicked = True
                    print(f"    제목 영역 클릭 OK ({sel[:40]})")
                    break
            except Exception as e:
                last_err = e
                continue

        if not clicked:
            # 마지막 폴백: 제목 영역 외부 paragraph라도 찾아 클릭
            try:
                first_p = await frame.query_selector(".se-text-paragraph")
                if first_p:
                    await self._human_click(first_p)
                    await asyncio.sleep(0.3)
                    clicked = True
                    print("    제목 영역 폴백 (첫 paragraph) 클릭")
            except Exception as e:
                last_err = e

        if not clicked:
            print(f"    ⚠ 제목 영역 클릭 실패: {last_err}")
            try:
                await capture_failure(
                    self.page,
                    stage="title_input_click_failed",
                    reason=f"제목 영역 셀렉터 모두 실패: {last_err}",
                )
            except Exception:
                pass
            raise RuntimeError(f"제목 영역을 찾을 수 없습니다: {last_err}")

        # 타이핑
        await self._human_type(title, delay_range=(10, 25))
        print(f"    ✓ 제목: {title[:40]}...")

        # 본문으로 이동 — 본문 영역 직접 클릭
        await asyncio.sleep(0.5)
        try:
            # SmartEditor ONE: 본문은 .se-sections 안에 있고, 제목은 .se-documentTitle 안에 있음
            body_area = await frame.query_selector(".se-sections .se-text-paragraph")
            if not body_area:
                body_area = await frame.query_selector(".se-section-content .se-text-paragraph")
            if not body_area:
                # 제목 영역(.se-documentTitle) 바깥의 paragraph 찾기
                body_area = await frame.evaluate_handle("""
                    () => {
                        const all = document.querySelectorAll('.se-text-paragraph');
                        for (const el of all) {
                            if (!el.closest('.se-documentTitle')) return el;
                        }
                        return null;
                    }
                """)
                if await body_area.evaluate("el => el === null"):
                    body_area = None

            if body_area:
                await self._human_click(body_area)
                print("    ✓ 본문 영역 클릭 완료")
            else:
                await self.page.keyboard.press("Enter")
                print("    ⚠ 본문 영역 못 찾음, Enter로 이동")
        except Exception as e:
            print(f"    ⚠ 본문 이동 실패({e}), Enter로 이동")
            await self.page.keyboard.press("Enter")
        await asyncio.sleep(0.5)

    async def _insert_empty_line(self):
        """빈 줄(여백) 삽입"""
        await self.page.keyboard.press("Enter")
        await asyncio.sleep(0.1)

    async def _exit_quotation(self, frame: Frame):
        """인용구 밖으로 나가기 — 인용구 바로 아래에 커서 배치

        핵심: 마지막 paragraph가 아닌, 현재 인용구 컴포넌트의 바로 아래로 이동.
        방법: 인용구 컴포넌트의 bounding box 아래쪽을 클릭.
        """
        try:
            # 현재 활성화된 인용구 컴포넌트의 위치를 찾아서 바로 아래 클릭
            # 가장 마지막 인용구 = 방금 생성된 것
            quotations = await frame.query_selector_all('.se-component.se-quotation')
            if quotations:
                last_quote = quotations[-1]
                box = await last_quote.bounding_box()
                if box:
                    # 인용구 박스 바로 아래 (20px 아래) 클릭
                    click_x = box["x"] + box["width"] * 0.5
                    click_y = box["y"] + box["height"] + 20
                    await self.page.mouse.click(click_x, click_y)
                    await asyncio.sleep(0.5)
                    return True
        except Exception:
            pass

        try:
            # 폴백: .se-content 영역의 맨 아래 빈 공간 클릭
            content_area = await frame.query_selector('.se-content')
            if content_area:
                box = await content_area.bounding_box()
                if box:
                    click_x = box["x"] + box["width"] * 0.5
                    click_y = box["y"] + box["height"] - 10
                    await self.page.mouse.click(click_x, click_y)
                    await asyncio.sleep(0.5)
                    return True
        except Exception:
            pass

        # 최종 폴백: ArrowDown 반복으로 이동
        for _ in range(5):
            await self.page.keyboard.press("ArrowDown")
            await asyncio.sleep(0.1)
        await self.page.keyboard.press("End")
        await asyncio.sleep(0.2)
        return False

    async def _click_below_component(self, frame: Frame):
        """현재 컴포넌트(이미지/구분선 등) 아래로 커서 이동"""
        try:
            content_area = await frame.query_selector('.se-content')
            if content_area:
                box = await content_area.bounding_box()
                if box:
                    click_x = box["x"] + box["width"] * 0.5
                    click_y = box["y"] + box["height"] - 10
                    await self.page.mouse.click(click_x, click_y)
                    await asyncio.sleep(0.5)
                    return
        except Exception:
            pass
        # 폴백
        for _ in range(3):
            await self.page.keyboard.press("ArrowDown")
            await asyncio.sleep(0.1)
        await self.page.keyboard.press("End")

    async def _reset_editor_format(self, frame: Frame):
        """에디터 서식 토글(볼드·취소선 등)을 강제 OFF + 툴바 버튼 비활성화.

        3단계 방어:
        1. SmartEditor 툴바의 취소선 버튼이 active면 클릭해서 끔
        2. execCommand로 커서 위치 서식 제거
        3. 기존 입력된 텍스트의 취소선 관련 태그·스타일 직접 제거
        """
        # 1단계: 툴바의 취소선 버튼 active 상태 확인 → 클릭으로 끄기
        try:
            strike_btn = await frame.query_selector(
                'button[data-name="strikethrough"], '
                'button.se-toolbar-button-strikethrough'
            )
            if strike_btn:
                is_active = await strike_btn.evaluate(
                    "el => el.classList.contains('se-toolbar-button-active') || "
                    "el.getAttribute('aria-pressed') === 'true'"
                )
                if is_active:
                    await strike_btn.click()
                    print("    [서식] 취소선 툴바 버튼 OFF")
                    await asyncio.sleep(0.3)
        except Exception:
            pass

        # 2단계: execCommand로 서식 상태 초기화 (iframe 컨텍스트)
        try:
            await frame.evaluate("""
                () => {
                    const content = document.querySelector('.se-content');
                    if (content) content.focus();
                    try { document.execCommand('removeFormat', false, null); } catch(e) {}
                    const formats = ['strikeThrough', 'bold', 'italic', 'underline'];
                    formats.forEach(fmt => {
                        try {
                            if (document.queryCommandState(fmt)) {
                                document.execCommand(fmt, false, null);
                            }
                        } catch(e) {}
                    });
                }
            """)
        except Exception:
            pass

        # 3단계: 이미 입력된 텍스트에서 취소선 태그·스타일 직접 제거
        try:
            await frame.evaluate("""
                () => {
                    // <s>, <del>, <strike> 태그를 span으로 교체
                    document.querySelectorAll('s, del, strike').forEach(el => {
                        const span = document.createElement('span');
                        span.innerHTML = el.innerHTML;
                        el.parentNode.replaceChild(span, el);
                    });
                    // text-decoration: line-through 인라인 스타일 제거
                    document.querySelectorAll('[style*="line-through"]').forEach(el => {
                        el.style.textDecoration = 'none';
                    });
                }
            """)
        except Exception:
            pass

        print("    [서식] 에디터 서식 초기화 완료")

    async def _input_body(self, frame: Frame, blocks, image_paths: list[Path]):
        """본문 블록별 입력 — 가독성 패턴 적용

        참조 블로그 패턴: 소제목(볼드) → 빈줄 → 이미지 → 빈줄 → 본문 2~3줄 → 빈줄 반복
        """
        # 이전 세션 잔여 서식(취소선·볼드·색상 등) 토글 상태 초기화
        # 여러 번 실패한 발행으로 SmartEditor 툴바 상태가 오염돼
        # 본문 전체에 취소선이 적용되는 증상 방어
        await self._reset_editor_format(frame)

        image_idx = 0
        total = len(blocks)

        for i, block in enumerate(blocks):
            if block.type == BlockType.PARAGRAPH:
                # 강조 마커 파싱
                plain_text, emphasis_phrases = parse_emphasis(block.text)
                # 문단 텍스트 입력 + 가독성 줄바꿈
                # 3~4문장마다 2줄 여백 삽입 → 문단 내 호흡감 부여
                sentences = self._split_for_readability(plain_text)
                for si, sentence in enumerate(sentences):
                    await self._human_type(sentence, delay_range=(3, 8))
                    await self.page.keyboard.press("Enter")
                    await asyncio.sleep(0.1)
                    # 3~4문장마다 빈 줄 추가 (문단 내 소그룹 분리)
                    if (si + 1) % 3 == 0 and si < len(sentences) - 1:
                        await self._insert_empty_line()
                # 방금 입력한 텍스트에서 취소선 태그·스타일 즉시 제거
                try:
                    await frame.evaluate("""
                        () => {
                            document.querySelectorAll('s, del, strike').forEach(el => {
                                const span = document.createElement('span');
                                span.innerHTML = el.innerHTML;
                                el.parentNode.replaceChild(span, el);
                            });
                            document.querySelectorAll('[style*="line-through"]').forEach(el => {
                                el.style.textDecoration = 'none';
                            });
                        }
                    """)
                except Exception:
                    pass
                # 문단 사이 여백 2줄
                await self._insert_empty_line()
                await self._insert_empty_line()
                # 강조 문구가 있으면 색상+굵기 적용
                if emphasis_phrases:
                    await self._apply_emphasis(frame, emphasis_phrases)

            elif block.type == BlockType.HEADING:
                # 마크다운에서 지정된 스타일 우선, 없으면 테마 스타일 적용
                heading_style = getattr(block, 'quote_style', None)
                if not heading_style or heading_style == 'default':
                    heading_style = self.heading_quote_style
                await self._insert_heading(frame, block.text, quote_style=heading_style)

            elif block.type == BlockType.IMAGE:
                if image_idx < len(image_paths):
                    await self._insert_image(frame, image_paths[image_idx])
                    image_idx += 1

            elif block.type == BlockType.QUOTE:
                q_style = getattr(block, 'quote_style', None)
                if not q_style or q_style == 'default':
                    q_style = self.body_quote_style
                await self._insert_quote(frame, block.text, quote_style=q_style)

            elif block.type == BlockType.HORIZONTAL_RULE:
                await self._insert_horizontal_rule(frame)

            # 진행률 표시
            if (i + 1) % 5 == 0 or i == total - 1:
                print(f"    진행: {i + 1}/{total}")

            # 자연스러운 딜레이
            if i % 3 == 0:
                await asyncio.sleep(random.uniform(0.2, 0.6))

        print("    ✓ 본문 입력 완료")

    def _split_for_readability(self, text: str) -> list[str]:
        """가독성 기반 줄바꿈 분리.

        규칙 (우선순위 순):
        1. 마침표/느낌표/물음표 뒤 → 줄바꿈
        2. 구어체 종결(~요, ~죠, ~거든, ~는데, ~음, ~임) 뒤 공백 → 줄바꿈
        3. 20자 이상 진행 후 쉼표(,) → 줄바꿈
        4. 5자 미만 조각은 앞 줄에 병합 (너무 짧은 줄 방지)
        """
        import re

        # 1차: 마침표/느낌표/물음표 뒤 공백 기준 분리
        chunks = re.split(r'(?<=[.!?])\s+', text)

        # 2차: 각 조각에서 구어체 종결어미 뒤 공백 기준 추가 분리
        ENDINGS = (
            '거든요', '잖아요', '했어요', '됐어요', '같아요', '봤어요',
            '있어요', '없어요', '했는데', '인데요', '는데요', '든요',
            '거든', '잖아', '죠',
        )
        expanded = []
        for chunk in chunks:
            # 종결어미 + 공백 위치를 찾아 수동 분리
            parts = []
            remaining = chunk
            while remaining:
                best_pos = -1
                for ending in ENDINGS:
                    idx = remaining.find(ending)
                    if idx >= 0:
                        end_pos = idx + len(ending)
                        # 종결어미 뒤에 공백이 있어야 줄바꿈 대상
                        if end_pos < len(remaining) and remaining[end_pos] == ' ':
                            if best_pos < 0 or end_pos < best_pos:
                                best_pos = end_pos
                if best_pos >= 0:
                    parts.append(remaining[:best_pos].strip())
                    remaining = remaining[best_pos:].strip()
                else:
                    parts.append(remaining.strip())
                    break
            expanded.extend(p for p in parts if p)

        # 3차: 긴 조각(20자 이상)에서 쉼표 뒤 공백 기준 추가 분리
        result = []
        for chunk in expanded:
            if len(chunk) >= 20 and ',' in chunk:
                # 쉼표 뒤 공백에서 분리하되, 앞 조각이 5자 이상일 때만
                sub_parts = re.split(r',\s+', chunk)
                rebuilt = []
                for j, sp in enumerate(sub_parts):
                    if j < len(sub_parts) - 1:
                        rebuilt.append(sp + ',')
                    else:
                        rebuilt.append(sp)
                # 5자 미만 조각은 앞에 병합
                merged = []
                for sp in rebuilt:
                    if merged and len(sp.strip()) < 5:
                        merged[-1] = merged[-1] + ' ' + sp
                    else:
                        merged.append(sp)
                result.extend(merged)
            else:
                result.append(chunk)

        # 4차: 빈 문자열 제거 + 최종 5자 미만 병합
        final = []
        for line in result:
            line = line.strip()
            if not line:
                continue
            if final and len(line) < 5:
                final[-1] = final[-1] + ' ' + line
            else:
                final.append(line)

        return final if final else [text]

    async def _change_quotation_style(self, frame: Frame, style: str):
        """삽입된 인용구의 스타일을 JavaScript로 변경

        네이버 SmartEditor ONE 인용구 5종:
        - default: 큰따옴표 ("")
        - quotation_bubble: 말풍선
        - quotation_line: 세로선
        - quotation_underline: 밑줄
        - quotation_corner: 모서리 꺾쇠
        """
        style_class_map = {
            "default": "se-l-default",
            "bubble": "se-l-quotation_bubble",
            "line": "se-l-quotation_line",
            "underline": "se-l-quotation_underline",
            "corner": "se-l-quotation_corner",
        }
        target_class = style_class_map.get(style, "se-l-default")
        if target_class == "se-l-default":
            return  # 기본 스타일이면 변경 불필요

        result = await frame.evaluate(f"""
            () => {{
                const quotes = document.querySelectorAll('.se-component.se-quotation');
                const q = quotes[quotes.length - 1];
                if (!q) return 'no quotation';

                // 컴포넌트 래퍼의 레이아웃 클래스만 변경 (이벤트 디스패치 금지!)
                // change 이벤트를 보내면 SmartEditor가 재렌더링하며 텍스트가 초기화됨
                q.className = q.className.replace(/se-l-[\\w]+/, '{target_class}');

                return 'ok';
            }}
        """)
        if result == 'ok':
            print(f"      스타일 변경: {style}")
        else:
            print(f"      ⚠ 스타일 변경 실패({result})")

    async def _insert_heading(self, frame: Frame, text: str, quote_style: str = "default"):
        """소제목 삽입 — 인용구 스타일 선택 가능 + 본문 복귀

        인용구 5종 스타일 지원:
        - default: 큰따옴표, bubble: 말풍선, line: 세로선
        - underline: 밑줄, corner: 모서리 꺾쇠
        """
        # 소제목 전 여백
        await self._insert_empty_line()
        await self._insert_empty_line()

        # 인용구 버튼 클릭 (기본 스타일로 삽입)
        quote_btn = await frame.query_selector('button[data-name="quotation"]')
        if quote_btn:
            try:
                await quote_btn.click(timeout=5000)
            except Exception as e:
                print(f"    ⚠ 인용구 버튼 클릭 실패: {str(e)[:60]}, 볼드 폴백")
                await self._human_type(text, delay_range=(5, 12))
                await self.page.keyboard.press("Home")
                await self.page.keyboard.down("Shift")
                await self.page.keyboard.press("End")
                await self.page.keyboard.up("Shift")
                await asyncio.sleep(0.2)
                await self.page.keyboard.press("Meta+b")
                await asyncio.sleep(0.2)
                await self.page.keyboard.press("End")
                await self.page.keyboard.press("Enter")
                print(f"    ✓ 소제목(볼드 폴백): {text[:30]}...")
                return
            await asyncio.sleep(1.0)

            # ★ JavaScript로 인용구 내용에 직접 텍스트 삽입
            escaped = text.replace("\\", "\\\\").replace("'", "\\'")
            result = await frame.evaluate(f"""
                () => {{
                    const quotes = document.querySelectorAll('.se-component.se-quotation');
                    const q = quotes[quotes.length - 1];
                    if (!q) return 'no quotation';
                    const span = q.querySelector('.se-quote .se-text-paragraph span.__se-node');
                    if (!span) return 'no span';
                    span.textContent = '{escaped}';
                    const ph = q.querySelector('.se-quote .se-placeholder');
                    if (ph) ph.remove();
                    const mod = q.querySelector('.se-quote');
                    if (mod) mod.classList.remove('se-is-empty');
                    const para = q.querySelector('.se-quote .se-text-paragraph');
                    if (para) para.dispatchEvent(new InputEvent('input', {{bubbles:true, inputType:'insertText', data:'{escaped}'}}));
                    return 'ok';
                }}
            """)

            if result == 'ok':
                print(f"    ✓ 소제목(인용구/{quote_style}): {text[:30]}...")
            else:
                print(f"    ⚠ 인용구 JS 삽입 실패({result}), 볼드 폴백")
                await self._human_type(text, delay_range=(5, 12))
                await self.page.keyboard.press("Home")
                await self.page.keyboard.down("Shift")
                await self.page.keyboard.press("End")
                await self.page.keyboard.up("Shift")
                await asyncio.sleep(0.2)
                await self.page.keyboard.press("Meta+b")
                await asyncio.sleep(0.2)
                await self.page.keyboard.press("End")
                await self.page.keyboard.press("Enter")

            # 인용구 밖으로 나가기 (먼저 exit → 그 다음 스타일 변경)
            await self._exit_quotation(frame)
            await asyncio.sleep(0.3)

            # ★ 스타일 변경은 exit 후에 적용 (exit 전에 하면 SmartEditor가 텍스트 초기화)
            if result == 'ok':
                await self._change_quotation_style(frame, quote_style)
        else:
            # 폴백: 볼드 텍스트
            await self._human_type(text, delay_range=(5, 12))
            await self.page.keyboard.press("Home")
            await self.page.keyboard.down("Shift")
            await self.page.keyboard.press("End")
            await self.page.keyboard.up("Shift")
            await asyncio.sleep(0.2)
            await self.page.keyboard.press("Meta+b")
            await asyncio.sleep(0.2)
            await self.page.keyboard.press("End")
            await self.page.keyboard.press("Enter")
            print(f"    ✓ 소제목(볼드): {text[:30]}...")

    async def _insert_image(self, frame: Frame, image_path: Path):
        """이미지 삽입 + 전후 여백"""
        await self._insert_empty_line()

        try:
            img_btn = await frame.query_selector('button[data-name="image"]')
            if not img_btn:
                img_btn = await frame.query_selector("button.se-image-toolbar-button")

            if img_btn:
                async with self.page.expect_file_chooser(timeout=10000) as fc_info:
                    await img_btn.click()
                file_chooser = await fc_info.value
                await file_chooser.set_files(str(image_path))
                await asyncio.sleep(3)

                # 이미지 삽입 후 본문 영역으로 돌아가기
                await self._click_below_component(frame)
                print(f"    ✓ 이미지: {image_path.name}")
            else:
                print("    ⚠ 이미지 버튼 없음")
        except Exception as e:
            print(f"    ⚠ 이미지 실패: {e}")

        await self._insert_empty_line()

    async def _insert_quote(self, frame: Frame, text: str, quote_style: str = "default"):
        """인용구 삽입 — 스타일 선택 가능 + 본문 복귀"""
        await self._insert_empty_line()

        quote_btn = await frame.query_selector('button[data-name="quotation"]')
        if not quote_btn:
            quote_btn = await frame.query_selector('button.se-toolbar-button-quotation')

        if quote_btn:
            try:
                await quote_btn.click(timeout=5000)
            except Exception as e:
                print(f"    ⚠ 인용구 버튼 클릭 실패: {str(e)[:60]}")
                await self._human_type(f"「 {text} 」", delay_range=(5, 12))
                await self.page.keyboard.press("Enter")
                print(f"    ✓ 인용구(텍스트 폴백): {text[:30]}...")
                await self._insert_empty_line()
                return
            await asyncio.sleep(1.0)

            await asyncio.sleep(1.0)

            # ★ JavaScript로 인용구 내용에 직접 텍스트 삽입
            escaped = text.replace("\\", "\\\\").replace("'", "\\'")
            result = await frame.evaluate(f"""
                () => {{
                    const quotes = document.querySelectorAll('.se-component.se-quotation');
                    const q = quotes[quotes.length - 1];
                    if (!q) return 'no quotation';
                    const span = q.querySelector('.se-quote .se-text-paragraph span.__se-node');
                    if (!span) return 'no span';
                    span.textContent = '{escaped}';
                    const ph = q.querySelector('.se-quote .se-placeholder');
                    if (ph) ph.remove();
                    const mod = q.querySelector('.se-quote');
                    if (mod) mod.classList.remove('se-is-empty');
                    const para = q.querySelector('.se-quote .se-text-paragraph');
                    if (para) para.dispatchEvent(new InputEvent('input', {{bubbles:true, inputType:'insertText', data:'{escaped}'}}));
                    return 'ok';
                }}
            """)

            if result == 'ok':
                print(f"    ✓ 인용구({quote_style}): {text[:30]}...")
            else:
                print(f"    ⚠ 인용구 실패({result})")

            # 인용구 밖으로 나가기 (먼저 exit → 그 다음 스타일 변경)
            await self._exit_quotation(frame)
            await asyncio.sleep(0.3)

            # ★ 스타일 변경은 exit 후에 적용
            if result == 'ok':
                await self._change_quotation_style(frame, quote_style)
        else:
            # 폴백
            await self._human_type(f"「 {text} 」", delay_range=(5, 12))
            await self.page.keyboard.press("Enter")
            print(f"    ✓ 인용구(텍스트): {text[:30]}...")

        await self._insert_empty_line()

    async def _insert_horizontal_rule(self, frame: Frame):
        """구분선(수평선) 삽입 — 빈 줄 여백으로 섹션 구분

        SmartEditor ONE의 구분선 버튼은 툴바 접근이 불안정하므로,
        빈 줄 3개로 시각적 섹션 구분을 구현합니다.
        실제 인기 블로그에서도 빈 줄 + 인용구 조합이 더 자주 사용됩니다.
        """
        await self._insert_empty_line()
        await self._insert_empty_line()
        await self._insert_empty_line()
        print("    ✓ 구분선 (섹션 구분 여백)")

    async def _apply_emphasis(self, frame: Frame, phrases: list[str]):
        """방금 입력한 문단에서 특정 문구에 색상+굵기 강조 적용 (JS DOM 조작)

        SmartEditor ONE의 span 구조를 직접 조작하여
        강조 문구에 color + font-weight: bold 스타일을 적용합니다.
        """
        if not phrases:
            return

        color = self.accent_color
        # JS에서 사용할 문구 배열 생성 (특수문자 이스케이프)
        escaped_phrases = []
        for p in phrases:
            escaped = p.replace("\\", "\\\\").replace("'", "\\'")
            escaped_phrases.append(f"'{escaped}'")
        phrases_js = "[" + ",".join(escaped_phrases) + "]"

        result = await frame.evaluate(f"""
            () => {{
                const phrases = {phrases_js};
                const color = '{color}';
                const textComps = document.querySelectorAll('.se-component.se-text');
                if (textComps.length === 0) return 'no text components';

                // 최근 텍스트 컴포넌트들에서 강조 문구 검색 (마지막 3개)
                const searchRange = Math.min(3, textComps.length);
                let applied = 0;

                for (let ci = textComps.length - searchRange; ci < textComps.length; ci++) {{
                    const comp = textComps[ci];
                    const spans = comp.querySelectorAll('.se-text-paragraph span.__se-node');

                    spans.forEach(span => {{
                        let html = span.textContent;
                        let changed = false;

                        phrases.forEach(phrase => {{
                            if (html.includes(phrase)) {{
                                // textContent를 innerHTML로 전환하면서 강조 적용
                                // text-decoration:none 명시해 상위 요소의 취소선/밑줄 상속 방지
                                const styledPhrase = '<span style="color: ' + color + '; font-weight: bold; text-decoration: none;">' + phrase + '</span>';
                                html = html.split(phrase).join(styledPhrase);
                                changed = true;
                                applied++;
                            }}
                        }});

                        if (changed) {{
                            span.innerHTML = html;
                        }}
                    }});
                }}

                return applied > 0 ? 'ok:' + applied : 'not found';
            }}
        """)

        if result and result.startswith('ok'):
            count = result.split(':')[1] if ':' in result else '?'
            print(f"      강조 적용: {count}건 ({color})")
        else:
            print(f"      ⚠ 강조 적용 실패({result})")

    async def _click_publish(self, frame: Frame) -> str | None:
        """발행 버튼 클릭 — 발행 버튼은 iframe 안과 메인 페이지 양쪽에서 탐색"""
        try:
            publish_btn = None

            # 1차: 에디터 iframe 내부에서 찾기
            for selector in [
                'button[class*="publish_btn"]',
                '[class*="publish_btn"] button',
            ]:
                publish_btn = await frame.query_selector(selector)
                if publish_btn and await publish_btn.is_visible():
                    break
                publish_btn = None

            # 2차: 메인 페이지 + 모든 프레임에서 찾기
            if not publish_btn:
                for f in self.page.frames:
                    for selector in [
                        'button[class*="publish_btn"]',
                        'button:has-text("발행")',
                    ]:
                        try:
                            btn = await f.query_selector(selector)
                            if btn:
                                text = await btn.evaluate("el => el.textContent?.trim() || ''")
                                if "발행" in text and "예약" not in text:
                                    publish_btn = btn
                                    print(f"    발행 버튼 발견: frame={f.name}, text={text}")
                                    break
                        except Exception:
                            continue
                    if publish_btn:
                        break

            if publish_btn:
                await publish_btn.click()
                await asyncio.sleep(3)

                # 발행 확인 다이얼로그 처리
                for f in self.page.frames:
                    try:
                        confirm_btn = await f.query_selector(
                            'button:has-text("발행"), button:has-text("확인")'
                        )
                        if confirm_btn and await confirm_btn.is_visible():
                            await confirm_btn.click()
                            await asyncio.sleep(5)
                            break
                    except Exception:
                        continue

                return self.page.url

            print("    ⚠ 발행 버튼을 찾을 수 없음")
            return None

        except Exception as e:
            print(f"    ⚠ 발행 에러: {e}")
            return None

    async def save_draft(self, frame: Frame) -> bool:
        """임시저장"""
        try:
            save_btn = await self.page.query_selector(
                'button[class*="save_btn"], button:has-text("저장")'
            )
            if save_btn:
                await save_btn.click()
                await asyncio.sleep(2)
                print("    ✓ 임시저장 완료")
                return True
        except Exception as e:
            print(f"    ⚠ 저장 실패: {e}")
        return False

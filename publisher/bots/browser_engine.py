"""
Playwright 브라우저 엔진 — stealth mode + 자동 로그인 + 인간형 동작
"""

import asyncio
import os
import random
import sys
from pathlib import Path

from playwright.async_api import (
    async_playwright,
    BrowserContext,
    Page,
    Playwright,
    Frame,
)

from config import settings
from bots.login_debug import capture_failure

# PyInstaller 번들에서 Playwright 브라우저를 시스템 캐시에서 찾도록 설정
if getattr(sys, "frozen", False):
    if sys.platform == "darwin":
        _pw_cache = Path.home() / "Library" / "Caches" / "ms-playwright"
    elif sys.platform == "win32":
        _pw_cache = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "ms-playwright"
    else:
        _pw_cache = Path.home() / ".cache" / "ms-playwright"
    if _pw_cache.exists():
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(_pw_cache)


STEALTH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-infobars",
]

STEALTH_SCRIPT = """
    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
    window.chrome = {runtime: {}};
    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
    Object.defineProperty(navigator, 'languages', {get: () => ['ko-KR', 'ko', 'en-US', 'en']});
"""


class BrowserEngine:
    """Playwright 브라우저 엔진"""

    def __init__(self):
        self._playwright: Playwright | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    def _clear_profile_locks(self, profile: str):
        """크롬 프로필 잠금 파일 강제 제거 (이전 세션이 비정상 종료된 경우)"""
        profile_path = Path(profile)
        for lock_file in ["SingletonLock", "SingletonCookie", "SingletonSocket"]:
            lock = profile_path / lock_file
            try:
                if lock.exists() or lock.is_symlink():
                    lock.unlink()
                    print(f"  [브라우저] 잠금 파일 제거: {lock_file}")
            except Exception:
                pass

    def _kill_stale_chrome(self, profile: str):
        """해당 프로필을 사용 중인 기존 크롬 프로세스 종료"""
        import subprocess
        try:
            result = subprocess.run(
                ["pgrep", "-f", profile],
                capture_output=True, text=True, timeout=5,
            )
            pids = result.stdout.strip().split("\n")
            for pid in pids:
                if pid.strip():
                    try:
                        os.kill(int(pid.strip()), 9)
                        print(f"  [브라우저] 기존 크롬 프로세스 종료: PID {pid.strip()}")
                    except (ProcessLookupError, PermissionError):
                        pass
        except Exception:
            pass

    async def launch(self, profile_path: str | None = None) -> Page:
        """브라우저 실행 (기존 세션이 있으면 정리 후 새로 시작)"""
        # 기존 페이지가 살아있으면 재사용
        if self._page and not self._page.is_closed():
            try:
                await self._page.evaluate("1")  # 실제로 살아있는지 확인
                return self._page
            except Exception:
                print("  [브라우저] 기존 세션이 죽어있음, 정리 후 재시작...")
                await self.close()

        # 기존 세션이 죽어있으면 정리
        if self._context or self._playwright:
            await self.close()

        profile = profile_path or str(
            settings.chrome_profiles_dir / "default"
        )
        print(f"  [브라우저] 프로필 경로: {profile} (존재: {Path(profile).exists()})")
        Path(profile).mkdir(parents=True, exist_ok=True)

        # 잠금 파일 + 기존 프로세스 정리
        self._kill_stale_chrome(profile)
        await asyncio.sleep(1)
        self._clear_profile_locks(profile)

        self._playwright = await async_playwright().start()

        self._context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=profile,
            headless=False,
            args=STEALTH_ARGS,
            viewport={"width": 1280, "height": 900},
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            ignore_default_args=["--enable-automation"],
        )

        await self._context.add_init_script(STEALTH_SCRIPT)
        self._page = (
            self._context.pages[0]
            if self._context.pages
            else await self._context.new_page()
        )
        return self._page

    @property
    def page(self) -> Page:
        if not self._page or self._page.is_closed():
            raise RuntimeError("브라우저가 실행되지 않았습니다.")
        return self._page

    @property
    def context(self) -> BrowserContext:
        if not self._context:
            raise RuntimeError("브라우저가 실행되지 않았습니다.")
        return self._context

    async def close(self):
        """브라우저 완전 종료 (예외 발생해도 무조건 정리)"""
        try:
            if self._context:
                await self._context.close()
        except Exception:
            pass
        try:
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass
        self._context = None
        self._playwright = None
        self._page = None

    # ------------------------------------------------------------------
    # 자동 로그인
    # ------------------------------------------------------------------

    async def _is_logged_in(self) -> bool:
        """네이버 로그인 상태 확인

        방식: 로그인 페이지로 직접 이동한 뒤 URL이 그대로 남아 있으면 미로그인,
        다른 곳으로 자동 리다이렉트되면 로그인 상태. 셀렉터에 의존하지 않아
        네이버 UI 변경에 영향받지 않음.
        """
        page = self.page
        try:
            await page.goto(
                "https://nid.naver.com/nidlogin.login?mode=form",
                wait_until="domcontentloaded",
            )
            await asyncio.sleep(2)
            url = page.url.lower()
            # 로그인 페이지에 머물러 있으면 미로그인
            if "nidlogin" in url or "/login" in url:
                return False
            # 리다이렉트됨 → 이미 로그인된 상태
            return True
        except Exception:
            return False

    async def _warmup_blog_cookies(self) -> None:
        """블로그 관련 쿠키를 선제 생성한다.

        blog.naver.com/MyBlog.naver 는 blog.naver.com 도메인 쿠키가 있어야
        사용자의 실제 블로그로 정상 리다이렉트된다. 신규 프로필(첫 로그인)은
        이 쿠키가 없어 감지가 실패한다. 로그인 성공 직후 블로그 홈을 1회
        방문해 쿠키를 확보한다. 실패해도 발행 흐름은 계속 진행한다.
        """
        try:
            print("  [워밍업] blog.naver.com 쿠키 생성 중...")
            await self.page.goto("https://blog.naver.com/", wait_until="domcontentloaded")
            await asyncio.sleep(2)
            print("  [워밍업] ✓ 완료")
        except Exception as e:
            print(f"  [워밍업] ⚠ 실패 (무시하고 진행): {e}")

    async def auto_login(
        self,
        naver_id: str | None = None,
        naver_pw: str | None = None,
    ) -> bool:
        """네이버 자동 로그인 (Playwright 네이티브 입력 방식)"""
        import json

        uid = naver_id or settings.NAVER_ID
        pwd = naver_pw or settings.NAVER_PW

        if not uid or not pwd:
            print("  [로그인] ⚠ NAVER_ID/NAVER_PW가 설정되지 않았습니다.")
            return False

        page = self.page

        # 1. 로그인 페이지로 직접 이동
        login_url = "https://nid.naver.com/nidlogin.login?mode=form"
        print(f"  [로그인] 로그인 페이지 이동...")
        await page.goto(login_url, wait_until="domcontentloaded")
        await asyncio.sleep(3)

        # 이미 로그인된 상태면 (리다이렉트로 로그인 페이지를 벗어남)
        if "nidlogin" not in page.url and "login" not in page.url.lower():
            print("  [로그인] ✓ 이미 로그인되어 있습니다.")
            await self._warmup_blog_cookies()
            return True

        print("  [로그인] 자동 로그인 시작...")

        # 2. 아이디 입력 (Playwright fill → type → JS 폴백)
        try:
            id_field = await page.wait_for_selector("#id", timeout=10000)
            if id_field:
                await id_field.click()
                await asyncio.sleep(0.5)

                # 방법 1: Playwright fill (가장 안정적)
                try:
                    await page.fill("#id", uid)
                    await asyncio.sleep(0.3)
                except Exception:
                    pass

                # 값 확인 → 비어있으면 폴백
                current_val = await id_field.evaluate("el => el.value")
                if not current_val:
                    # 방법 2: 한 글자씩 타이핑
                    try:
                        await id_field.click(click_count=3)  # 전체 선택
                        await page.keyboard.type(uid, delay=50)
                        await asyncio.sleep(0.3)
                    except Exception:
                        pass

                # 다시 확인 → 비어있으면 JS 인젝션
                current_val = await id_field.evaluate("el => el.value")
                if not current_val:
                    safe_uid = json.dumps(uid)  # 특수문자 이스케이핑
                    await page.evaluate(f"""
                        const el = document.getElementById('id');
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype, 'value'
                        ).set;
                        nativeInputValueSetter.call(el, {safe_uid});
                        el.dispatchEvent(new Event('input', {{bubbles: true}}));
                        el.dispatchEvent(new Event('change', {{bubbles: true}}));
                    """)
                    await asyncio.sleep(0.3)

                print(f"  [로그인] 아이디 입력 완료")
        except Exception as e:
            print(f"  [로그인] ⚠ 아이디 입력 실패: {e}")
            await capture_failure(page, stage="id_input_failed", reason=str(e))
            return False

        # 3. 비밀번호 입력 (동일한 3단계 폴백)
        try:
            pw_field = await page.wait_for_selector("#pw", timeout=5000)
            if pw_field:
                await pw_field.click()
                await asyncio.sleep(0.5)

                # 방법 1: Playwright fill
                try:
                    await page.fill("#pw", pwd)
                    await asyncio.sleep(0.3)
                except Exception:
                    pass

                current_val = await pw_field.evaluate("el => el.value")
                if not current_val:
                    # 방법 2: 타이핑
                    try:
                        await pw_field.click(click_count=3)
                        await page.keyboard.type(pwd, delay=50)
                        await asyncio.sleep(0.3)
                    except Exception:
                        pass

                current_val = await pw_field.evaluate("el => el.value")
                if not current_val:
                    # 방법 3: JS 인젝션 (특수문자 안전)
                    safe_pwd = json.dumps(pwd)
                    await page.evaluate(f"""
                        const el = document.getElementById('pw');
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLInputElement.prototype, 'value'
                        ).set;
                        nativeInputValueSetter.call(el, {safe_pwd});
                        el.dispatchEvent(new Event('input', {{bubbles: true}}));
                        el.dispatchEvent(new Event('change', {{bubbles: true}}));
                    """)
                    await asyncio.sleep(0.3)

                print(f"  [로그인] 비밀번호 입력 완료")
        except Exception as e:
            print(f"  [로그인] ⚠ 비밀번호 입력 실패: {e}")
            await capture_failure(page, stage="pw_input_failed", reason=str(e))
            return False

        # 4. 로그인 버튼 클릭
        try:
            login_btn = await page.query_selector(
                '#log\\.login, button[type="submit"], .btn_login, .btn_global'
            )
            if login_btn:
                await login_btn.click()
            else:
                await page.keyboard.press("Enter")

            print("  [로그인] 로그인 버튼 클릭")
        except Exception as e:
            print(f"  [로그인] 로그인 버튼 실패, Enter 시도: {e}")
            await page.keyboard.press("Enter")

        # 5. 로그인 결과 대기
        await asyncio.sleep(3)
        for i in range(60):
            await asyncio.sleep(1)
            url = page.url
            if "nidlogin" not in url and "login" not in url.lower():
                print(f"  [로그인] ✓ 로그인 성공! → {url[:60]}")
                await self._warmup_blog_cookies()
                return True

            # CAPTCHA 체크
            captcha = await page.query_selector("#captcha, .captcha, [class*='captcha']")
            if captcha:
                print("  [로그인] ⚠ CAPTCHA 감지! 브라우저에서 직접 해결하세요.")
                for j in range(120):
                    await asyncio.sleep(1)
                    if "nidlogin" not in page.url:
                        print("  [로그인] ✓ CAPTCHA 해결 후 로그인 성공!")
                        await self._warmup_blog_cookies()
                        return True
                await capture_failure(
                    page,
                    stage="captcha_timeout",
                    reason="CAPTCHA 120초 내 미해결",
                )
                return False

            # 에러 메시지 체크
            error = await page.query_selector(".error_message, #err_common")
            if error and await error.is_visible():
                err_text = await error.evaluate("el => el.textContent?.trim() || ''")
                print(f"  [로그인] ⚠ 로그인 에러: {err_text}")
                await capture_failure(
                    page,
                    stage="naver_error_shown",
                    reason="네이버 에러 메시지 노출",
                    extra={"err_text": err_text},
                )
                return False

        print("  [로그인] ⚠ 로그인 타임아웃")
        await capture_failure(
            page,
            stage="result_timeout",
            reason="로그인 결과 60초 대기 타임아웃",
        )
        return False

    async def wait_for_manual_login(
        self,
        timeout_seconds: int = 300,
        naver_id: str | None = None,
    ) -> bool:
        """수동 로그인 대기 — 사용자가 브라우저에서 직접 로그인할 때까지 기다림

        Args:
            timeout_seconds: 대기 시간 (기본 5분)
            naver_id: 미리 ID 칸에 채워넣을 네이버 아이디 (크롬 자동완성 덮어쓰기)

        Returns:
            로그인 성공 여부
        """
        page = self.page

        # 로그인 페이지로 이동
        login_url = "https://nid.naver.com/nidlogin.login?mode=form"
        print(f"  [수동로그인] 로그인 페이지로 이동합니다...")
        await page.goto(login_url, wait_until="domcontentloaded")
        await asyncio.sleep(2)

        # 이미 로그인 상태면 바로 성공
        if "nidlogin" not in page.url and "login" not in page.url.lower():
            print("  [수동로그인] ✓ 이미 로그인되어 있습니다.")
            await self._warmup_blog_cookies()
            return True

        # 크롬 자동완성 덮어쓰기 — 지정된 ID를 ID 칸에 입력
        if naver_id:
            try:
                print(f"  [수동로그인] ID 칸에 '{naver_id}' 자동 입력 중...")
                # ID 필드 대기 + 비우기 + 입력
                await page.wait_for_selector("#id", timeout=5000)
                await page.fill("#id", "")  # 크롬 자동완성 제거
                await asyncio.sleep(0.3)
                await page.fill("#id", naver_id)
                await asyncio.sleep(0.3)
                # 비밀번호 칸도 비움 (크롬 자동완성 제거)
                await page.fill("#pw", "")
                await asyncio.sleep(0.3)
                print(f"  [수동로그인] ID 입력 완료. 비밀번호만 직접 입력하세요.")
            except Exception as e:
                print(f"  [수동로그인] ⚠ ID 자동 입력 실패 (수동으로 입력하세요): {e}")

        print(f"  [수동로그인] 브라우저에서 직접 로그인해주세요. (최대 {timeout_seconds}초 대기)")
        print("  [수동로그인] 2차인증, CAPTCHA 등도 모두 처리하세요.")

        # 사용자가 로그인 완료할 때까지 URL 변화 감지
        for i in range(timeout_seconds):
            await asyncio.sleep(1)

            # 페이지 닫혔으면 실패
            if page.is_closed():
                print("  [수동로그인] ⚠ 브라우저가 닫혔습니다.")
                return False

            try:
                url = page.url
                # 로그인 완료 감지: URL이 로그인 페이지를 벗어남
                if "nidlogin" not in url and "login" not in url.lower():
                    print(f"  [수동로그인] ✓ 로그인 완료 감지! → {url[:60]}")
                    # 쿠키가 저장되도록 잠시 대기
                    await asyncio.sleep(2)
                    await self._warmup_blog_cookies()
                    return True
            except Exception:
                # 페이지 이동 중 일시적 에러
                pass

            # 30초마다 진행 상황 로그
            if i > 0 and i % 30 == 0:
                print(f"  [수동로그인] {i}초 경과, 계속 대기 중...")

        print(f"  [수동로그인] ⚠ {timeout_seconds}초 타임아웃")
        if not page.is_closed():
            await capture_failure(
                page,
                stage="manual_login_timeout",
                reason=f"수동 로그인 {timeout_seconds}초 타임아웃",
            )
        return False

    async def _detect_blog_id(self, naver_id: str) -> str:
        """실제 블로그 ID 감지 (로그인 ID와 다를 수 있음)"""
        import re
        page = self.page

        # 네이버 시스템 경로 (블로그 ID가 아닌 것들)
        INVALID_IDS = {
            "BlogHome", "MyBlog", "PostWrite", "PostWriteForm",
            "PostView", "PostList", "NBlogTop", "section",
            "naver", "blog", "",
        }

        print(f"  [에디터] 블로그 ID 감지 중... (입력값={naver_id})")

        # 방법 1: MyBlog.naver → 로그인된 사용자의 블로그로 리다이렉트
        await page.goto("https://blog.naver.com/MyBlog.naver", wait_until="domcontentloaded")
        await asyncio.sleep(3)
        await self._dismiss_blog_popups()

        current_url = page.url
        print(f"  [에디터] MyBlog.naver 후 URL = {current_url}")
        match = re.search(r"blog\.naver\.com/([A-Za-z0-9_]+)", current_url)
        if match and match.group(1) not in INVALID_IDS:
            detected_id = match.group(1)
            print(f"  [에디터] 블로그 ID 감지 (MyBlog): {detected_id}")
            return detected_id

        # 방법 1-B: admin.blog.naver.com → 관리자 페이지는 blog_id 필수로 포함
        try:
            await page.goto("https://admin.blog.naver.com/", wait_until="domcontentloaded")
            await asyncio.sleep(3)
            admin_url = page.url
            print(f"  [에디터] admin.blog.naver.com 후 URL = {admin_url}")
            match = re.search(r"[?&]blogId=([A-Za-z0-9_]+)", admin_url)
            if match and match.group(1) not in INVALID_IDS:
                detected_id = match.group(1)
                print(f"  [에디터] 블로그 ID 감지 (admin URL): {detected_id}")
                return detected_id
            match = re.search(r"blog\.naver\.com/([A-Za-z0-9_]+)", admin_url)
            if match and match.group(1) not in INVALID_IDS:
                detected_id = match.group(1)
                print(f"  [에디터] 블로그 ID 감지 (admin redirect): {detected_id}")
                return detected_id
        except Exception as e:
            print(f"  [에디터] admin 감지 실패: {e}")

        # 방법 2: 블로그 페이지에서 프로필 링크 추출
        try:
            profile_link = await page.query_selector('a[href*="blog.naver.com/"]')
            if profile_link:
                href = await profile_link.evaluate("el => el.href")
                match = re.search(r"blog\.naver\.com/([A-Za-z0-9_]+)", href)
                if match and match.group(1) not in INVALID_IDS:
                    detected_id = match.group(1)
                    print(f"  [에디터] 블로그 ID 감지 (프로필): {detected_id}")
                    return detected_id
        except Exception:
            pass

        # 방법 3: 쿠키에서 추출 (NID_BLOG_ID 등)
        try:
            cookies = await self._context.cookies("https://blog.naver.com/")
            for c in cookies:
                print(f"  [에디터] cookie {c['name']} = {str(c.get('value', ''))[:40]}")
                if c["name"] in ("NID_BLOG_ID", "BLOG_ID", "blog_id"):
                    v = c.get("value", "")
                    if v and v not in INVALID_IDS:
                        print(f"  [에디터] 블로그 ID 감지 (쿠키 {c['name']}): {v}")
                        return v
        except Exception as e:
            print(f"  [에디터] 쿠키 감지 실패: {e}")

        # 방법 4: 제공된 ID를 그대로 사용
        print(f"  [에디터] 블로그 ID 자동 감지 실패, 입력값 사용: {naver_id}")
        return naver_id

    async def _dismiss_blog_popups(self):
        """블로그 페이지 팝업 닫기"""
        page = self.page
        await asyncio.sleep(1)
        try:
            # 공지 팝업 닫기 버튼들
            for selector in [
                'button:has-text("닫기")',
                'button:has-text("7일동안 보지 않기")',
                '.popup_close',
                '[class*="close"]',
                'button[aria-label="닫기"]',
                '.layer_close',
            ]:
                btn = await page.query_selector(selector)
                if btn and await btn.is_visible():
                    await btn.click()
                    print("  [에디터] 팝업 닫음")
                    await asyncio.sleep(1)
                    return

            # X 버튼 (SVG 포함)
            close_btns = await page.query_selector_all('button')
            for btn in close_btns:
                try:
                    text = await btn.evaluate("el => el.textContent?.trim() || ''")
                    aria = await btn.evaluate("el => el.getAttribute('aria-label') || ''")
                    if '닫기' in text or '닫기' in aria or 'close' in aria.lower():
                        if await btn.is_visible():
                            await btn.click()
                            print("  [에디터] 팝업 닫음 (버튼 탐색)")
                            await asyncio.sleep(1)
                            return
                except Exception:
                    continue
        except Exception:
            pass

    async def _check_editor_loaded(self) -> bool:
        """에디터 iframe + 실제 콘텐츠 영역이 로드됐는지 확인.

        - 0.5초 간격으로 최대 20초 폴링
        - iframe URL/name 매칭 + iframe 내부에 .se-content 가 뜨는지 동시 확인
        - 도중에 페이지가 로그인 페이지로 튕기면 즉시 False 리턴해 상위에서 재시도 / 실패 처리
        """
        for _ in range(40):  # 0.5s × 40 = 20s
            try:
                url_lower = (self.page.url or "").lower()
                if "nidlogin" in url_lower or "/login" in url_lower:
                    # 로그인 세션 만료 — 에디터 로드 불가능 상태
                    print("  [에디터] 로그인 페이지로 튕김 감지 → 에디터 로드 중단")
                    return False
            except Exception:
                pass

            for frame in self.page.frames:
                matched = ("PostWrite" in (frame.url or "")) or (frame.name == "mainFrame")
                if not matched:
                    continue
                # iframe을 찾았으면 내부 에디터 콘텐츠가 실제로 떴는지도 확인
                try:
                    content = await frame.query_selector(".se-content")
                    if content:
                        return True
                except Exception:
                    # iframe이 아직 navigating 중 — 다음 tick에서 재시도
                    pass

            await asyncio.sleep(0.5)
        return False

    async def navigate_to_editor(self, blog_id: str) -> bool:
        """로그인 후 글쓰기 에디터 페이지로 이동"""
        page = self.page

        # 실제 블로그 ID 감지
        detected_id = await self._detect_blog_id(blog_id)

        # 감지된 ID와 원래 ID 모두 시도할 후보
        candidates = list(dict.fromkeys([detected_id, blog_id]))  # 중복 제거, 순서 유지

        for bid in candidates:
            # 각 ID에 대해 여러 URL 패턴 시도
            editor_urls = [
                f"https://blog.naver.com/{bid}?Redirect=Write",
                f"https://blog.naver.com/PostWriteForm.naver?blogId={bid}",
            ]

            for url in editor_urls:
                print(f"  [에디터] 시도: {url[:70]}...")
                try:
                    await page.goto(url, wait_until="domcontentloaded")
                except Exception:
                    continue
                await asyncio.sleep(3)

                # "유효하지 않은 요청" 페이지 감지 → 즉시 다음 시도
                error_text = await page.evaluate(
                    "document.body?.innerText?.includes('유효하지 않은 요청') || false"
                )
                if error_text:
                    print(f"  [에디터] 유효하지 않은 블로그 ID, 다음 시도...")
                    continue

                await self._dismiss_blog_popups()

                if await self._check_editor_loaded():
                    print(f"  [에디터] ✓ 에디터 로드 성공! (blogId={bid})")
                    return True

                print(f"  [에디터] 에디터를 못 찾음, 다음 시도...")

        # 최종 시도: 글쓰기 버튼 찾아서 클릭
        print(f"  [에디터] URL 직접 접근 실패. 블로그에서 글쓰기 버튼 탐색...")
        await page.goto("https://blog.naver.com/MyBlog.naver", wait_until="domcontentloaded")
        await asyncio.sleep(3)
        await self._dismiss_blog_popups()

        # "글쓰기" 버튼 찾기
        for selector in [
            'a:has-text("글쓰기")',
            'a[href*="Redirect=Write"]',
            'a[href*="postwrite"]',
            'a[href*="PostWrite"]',
            '.blog-menu a:has-text("글쓰기")',
        ]:
            try:
                btn = await page.query_selector(selector)
                if btn and await btn.is_visible():
                    await btn.click()
                    print(f"  [에디터] 글쓰기 버튼 클릭!")
                    await asyncio.sleep(5)
                    if await self._check_editor_loaded():
                        print(f"  [에디터] ✓ 에디터 로드 성공! (글쓰기 버튼)")
                        return True
            except Exception:
                continue

        print(f"  [에디터] ⚠ 모든 시도 실패. 현재 URL: {page.url[:80]}")
        return False

    # ------------------------------------------------------------------
    # 인간형 동작 헬퍼
    # ------------------------------------------------------------------

    async def human_type(self, text: str, delay_range: tuple[int, int] = (5, 15)):
        for char in text:
            await self.page.keyboard.type(char, delay=random.randint(*delay_range))
            if random.random() < 0.08:
                await asyncio.sleep(random.uniform(0.05, 0.2))

    async def random_delay(self, min_s: float = 0.3, max_s: float = 1.0):
        await asyncio.sleep(random.uniform(min_s, max_s))

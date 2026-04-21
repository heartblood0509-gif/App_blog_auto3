"""발행 엔드포인트 — SSE 실시간 진행"""

import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from bots.browser_engine import BrowserEngine
from bots.naver_blog_publisher import NaverBlogPublisher
from config import settings
from core.image_handler import save_base64_images
from db.database import get_session
from db.models import Account, Post

router = APIRouter()

# 발행 상태 관리
_tasks: dict[str, dict] = {}  # task_id -> {status, events_queue, ...}
_publish_lock = asyncio.Lock()
_browser_engine: BrowserEngine | None = None


class PublishImageData(BaseModel):
    index: int
    data: str
    mimeType: str = "image/jpeg"
    description: str = ""


class FormattingTheme(BaseModel):
    name: str = "default"
    accent_color: str = ""
    heading_quote_style: str = "default"
    body_quote_style: str = "default"


class PublishRequest(BaseModel):
    content_md: str
    images: list[PublishImageData] = []
    title: str = ""
    keyword: str = ""
    naver_account_id: str
    formatting_theme: FormattingTheme = FormattingTheme()
    auto_publish: bool = False


@router.post("/publish")
async def start_publish(req: PublishRequest):
    """발행 시작 — task_id를 반환하고 백그라운드에서 발행 진행"""
    if _publish_lock.locked():
        raise HTTPException(status_code=409, detail="발행이 이미 진행 중입니다.")

    # 계정 확인
    session = get_session()
    try:
        account = session.query(Account).filter_by(id=req.naver_account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="네이버 계정을 찾을 수 없습니다.")
        naver_id = account.username
        blog_id = naver_id  # 블로그 ID는 보통 네이버 ID와 동일
    finally:
        session.close()

    task_id = str(uuid.uuid4())
    events_queue: asyncio.Queue = asyncio.Queue()

    _tasks[task_id] = {
        "status": "started",
        "events_queue": events_queue,
        "cancelled": False,
    }

    # 백그라운드 발행 시작
    asyncio.create_task(
        _run_publish(
            task_id=task_id,
            content_md=req.content_md,
            images=[img.model_dump() for img in req.images],
            title=req.title,
            keyword=req.keyword,
            naver_id=naver_id,
            blog_id=blog_id,
            formatting_theme=req.formatting_theme.model_dump(),
            auto_publish=req.auto_publish,
            events_queue=events_queue,
        )
    )

    return {"task_id": task_id}


async def _run_publish(
    task_id: str,
    content_md: str,
    images: list[dict],
    title: str,
    keyword: str,
    naver_id: str,
    blog_id: str,
    formatting_theme: dict,
    auto_publish: bool,
    events_queue: asyncio.Queue,
):
    """실제 발행 수행 (백그라운드 태스크)"""
    global _browser_engine

    async def send_progress(step: str, progress: int, message: str, **extra):
        event = {"step": step, "progress": progress, "message": message, **extra}
        await events_queue.put(event)

    async with _publish_lock:
        try:
            # 1. 이미지 저장
            image_paths: list[Path] = []
            if images:
                await send_progress("images_save", 5, f"이미지 저장 중... ({len(images)}장)")
                output_dir = settings.images_dir / task_id
                image_paths = save_base64_images(images, output_dir)

            # 2. 브라우저 실행
            await send_progress("login", 10, "브라우저 실행 중...")
            if not _browser_engine:
                _browser_engine = BrowserEngine()
            page = await _browser_engine.launch()

            # 3. 로그인 확인
            await send_progress("login", 15, "네이버 로그인 확인 중...")
            is_logged_in = await _browser_engine._is_logged_in()
            if not is_logged_in:
                # 계정의 비밀번호는 DB에서 가져옴
                session = get_session()
                try:
                    account = session.query(Account).filter_by(username=naver_id).first()
                    naver_pw = ""
                    if account:
                        # profile_path는 구버전 호환용 fallback (다음 릴리즈에서 제거 예정)
                        naver_pw = account.password or account.profile_path or ""
                finally:
                    session.close()

                # 비밀번호가 있으면 자동 로그인, 없으면 수동 로그인 대기
                if naver_pw or settings.NAVER_PW:
                    await send_progress("login", 18, "네이버 자동 로그인 중...")
                    login_ok = await _browser_engine.auto_login(naver_id, naver_pw or settings.NAVER_PW)
                    if not login_ok:
                        # 자동 로그인 실패 시 수동 로그인 대기로 폴백
                        await send_progress("login", 18, "자동 로그인 실패. 브라우저에서 직접 로그인해주세요...")
                        login_ok = await _browser_engine.wait_for_manual_login(timeout_seconds=300, naver_id=naver_id)
                        if not login_ok:
                            debug_path = settings.storage_dir / "login_debug"
                            await send_progress(
                                "error", 0,
                                f"로그인 시간 초과. 디버그 자료: {debug_path}",
                                debug_dir=str(debug_path),
                            )
                            return
                else:
                    # 비밀번호 없음 → 수동 로그인 대기
                    await send_progress("login", 18, "브라우저에서 직접 로그인해주세요 (2차인증 포함)")
                    login_ok = await _browser_engine.wait_for_manual_login(timeout_seconds=300)
                    if not login_ok:
                        debug_path = settings.storage_dir / "login_debug"
                        await send_progress(
                            "error", 0,
                            f"로그인 시간 초과. 디버그 자료: {debug_path}",
                            debug_dir=str(debug_path),
                        )
                        return

            await send_progress("login", 20, "로그인 완료 (쿠키 자동 저장됨)")

            # 4. 에디터로 이동 (90초 내 완료 필수)
            await send_progress("navigate", 25, "블로그 에디터 이동 중...")
            if page.is_closed():
                await send_progress("error", 0, "브라우저가 종료된 상태입니다. 다시 시도해주세요.")
                return
            try:
                nav_ok = await asyncio.wait_for(
                    _browser_engine.navigate_to_editor(blog_id),
                    timeout=90,
                )
            except asyncio.TimeoutError:
                await send_progress("error", 0, "에디터 진입 타임아웃 (90초). 네이버 응답 지연 가능성.")
                return
            if not nav_ok:
                await send_progress("error", 0, "에디터 이동 실패. 블로그 ID를 확인해주세요.")
                return
            await send_progress("navigate", 30, "에디터 로드 완료")

            # 5. 발행 (최대 300초)
            if page.is_closed():
                await send_progress("error", 0, "브라우저가 종료됐습니다. 발행을 중단합니다.")
                return
            publisher = NaverBlogPublisher(page)

            def progress_callback(step: str, progress: int, message: str):
                asyncio.create_task(send_progress(step, progress, message))

            try:
                result_url = await asyncio.wait_for(
                    publisher.publish(
                        blog_id=blog_id,
                        content_md=content_md,
                        image_paths=image_paths if image_paths else None,
                        auto_publish=auto_publish,
                        formatting_theme=formatting_theme,
                        progress_callback=progress_callback,
                    ),
                    timeout=300,
                )
            except asyncio.TimeoutError:
                await send_progress("error", 0, "발행 타임아웃 (300초). 팝업이 떠있거나 네이버 응답 지연.")
                return

            # 6. 결과 저장
            session = get_session()
            try:
                post = Post(
                    account_id=naver_id,
                    keyword=keyword,
                    title=title,
                    content_md=content_md,
                    image_paths=[str(p) for p in image_paths],
                    status="published" if result_url else "completed",
                    published_url=result_url,
                )
                session.add(post)
                session.commit()
            finally:
                session.close()

            if result_url:
                await send_progress("done", 100, "발행 완료!", url=result_url)
            else:
                await send_progress("done", 100, "입력 완료! 브라우저에서 확인 후 수동 발행하세요.")

        except Exception as e:
            await send_progress("error", 0, f"발행 중 오류: {str(e)}")
        finally:
            # 자동 발행이면 브라우저 정리 / 수동이면 열어둠 (사용자가 수동 발행 가능)
            if auto_publish and _browser_engine:
                try:
                    await _browser_engine.close()
                except Exception:
                    pass
                _browser_engine = None
            _tasks[task_id]["status"] = "finished"


@router.get("/publish/{task_id}/status")
async def publish_status(task_id: str):
    """SSE로 발행 진행 상태 스트림"""
    if task_id not in _tasks:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다.")

    events_queue = _tasks[task_id]["events_queue"]

    async def event_generator():
        while True:
            try:
                event = await asyncio.wait_for(events_queue.get(), timeout=60)
                yield {"event": "progress", "data": str(event).replace("'", '"')}
                if event.get("step") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": "keepalive"}

    return EventSourceResponse(event_generator())


@router.post("/publish/{task_id}/cancel")
async def cancel_publish(task_id: str):
    """발행 취소"""
    if task_id not in _tasks:
        raise HTTPException(status_code=404, detail="태스크를 찾을 수 없습니다.")

    _tasks[task_id]["cancelled"] = True
    return {"status": "cancel_requested"}

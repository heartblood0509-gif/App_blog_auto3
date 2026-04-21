"""로그인 실패 디버그 자료 수집 — 스크린샷, HTML, 메타데이터."""

import json
from datetime import datetime
from pathlib import Path

from config import settings


def _debug_dir() -> Path:
    path = settings.storage_dir / "login_debug"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def capture_failure(
    page,
    *,
    stage: str,
    reason: str,
    extra: dict | None = None,
) -> Path:
    """실패 시점의 페이지 상태를 모두 저장하고 폴더 경로 반환."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    folder = _debug_dir() / f"{ts}_{stage}"
    folder.mkdir(parents=True, exist_ok=True)

    try:
        await page.screenshot(path=str(folder / "screenshot.png"), full_page=True)
    except Exception as e:
        (folder / "screenshot_error.txt").write_text(str(e), encoding="utf-8")

    try:
        html = await page.content()
        (folder / "page.html").write_text(html, encoding="utf-8")
    except Exception as e:
        (folder / "html_error.txt").write_text(str(e), encoding="utf-8")

    try:
        title = await page.title()
    except Exception:
        title = ""

    meta = {
        "timestamp": ts,
        "stage": stage,
        "reason": reason,
        "url": getattr(page, "url", ""),
        "title": title,
        **(extra or {}),
    }
    (folder / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"  [로그인] 🔍 디버그 자료 저장: {folder}")
    return folder

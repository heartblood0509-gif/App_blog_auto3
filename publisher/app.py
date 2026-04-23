"""BlogPublisher 앱 진입점 — FastAPI 서버 실행 + Playwright 초기 설정"""

import os
import subprocess
import sys
from pathlib import Path

import uvicorn

from config import settings, _get_playwright_cache_dir


class _TeeStream:
    def __init__(self, *streams):
        self._streams = streams
        self._primary = streams[0] if streams else None
    def write(self, data):
        for s in self._streams:
            try:
                s.write(data)
                s.flush()
            except Exception:
                pass
        return len(data) if isinstance(data, (str, bytes)) else 0
    def flush(self):
        for s in self._streams:
            try: s.flush()
            except Exception: pass
    def isatty(self):
        try:
            return bool(self._primary and self._primary.isatty())
        except Exception:
            return False
    def fileno(self):
        if self._primary is None:
            raise OSError("no fileno")
        return self._primary.fileno()
    def __getattr__(self, name):
        return getattr(self._primary, name)


def _setup_file_logging():
    log_path = settings.storage_dir / "publish.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = open(log_path, "a", encoding="utf-8", buffering=1)
    sys.stdout = _TeeStream(sys.stdout, log_file)
    sys.stderr = _TeeStream(sys.stderr, log_file)
    print(f"\n===== BlogPublisher 로그 시작 (PID {os.getpid()}) =====")


def ensure_playwright_browsers():
    """Playwright Chromium 브라우저가 설치되어 있는지 확인하고, 없으면 다운로드"""
    cache_dir = _get_playwright_cache_dir()
    chromium_dirs = list(cache_dir.glob("chromium-*")) if cache_dir.exists() else []

    if chromium_dirs:
        print(f"[BlogPublisher] Chromium 브라우저 확인됨: {chromium_dirs[0].name}")
        return True

    print("[BlogPublisher] Chromium 브라우저를 다운로드합니다... (최초 1회)")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "chromium"],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0:
            print("[BlogPublisher] Chromium 다운로드 완료!")
            return True
        else:
            print(f"[BlogPublisher] Chromium 다운로드 실패: {result.stderr}")
            return False
    except Exception as e:
        print(f"[BlogPublisher] Chromium 다운로드 오류: {e}")
        return False


def main():
    _setup_file_logging()
    print("=" * 50)
    print("  BlogPublisher Server v1.0.0")
    print("=" * 50)
    print(f"  데이터 경로: {settings.base_dir}")
    print(f"  DB 경로: {settings.db_path}")
    print(f"  포트: {settings.SERVER_PORT}")
    print("=" * 50)

    # Playwright 브라우저 확인
    ensure_playwright_browsers()

    # FastAPI 서버 실행
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=settings.SERVER_PORT,
        reload=not getattr(sys, "frozen", False),  # 개발 모드에서만 reload
        log_level="info",
    )


if __name__ == "__main__":
    main()

"""BlogPublisher 설정 — 크로스플랫폼 (macOS / Windows)"""

import os
import sys
from pathlib import Path

from pydantic_settings import BaseSettings


def _get_app_data_dir() -> Path:
    """OS별 앱 데이터 디렉토리"""
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "BlogPublisher"
    elif sys.platform == "win32":
        return Path(os.environ.get("APPDATA", Path.home())) / "BlogPublisher"
    else:
        return Path.home() / ".blogpublisher"


def _get_playwright_cache_dir() -> Path:
    """OS별 Playwright 브라우저 캐시 경로"""
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Caches" / "ms-playwright"
    elif sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "ms-playwright"
    else:
        return Path.home() / ".cache" / "ms-playwright"


# PyInstaller 번들 여부에 따라 .env 위치 결정
if getattr(sys, "frozen", False):
    _app_dir = _get_app_data_dir()
    _app_dir.mkdir(parents=True, exist_ok=True)
    _env_candidates = [
        _app_dir / ".env",
        Path(sys.executable).resolve().parent / ".env",
        Path.home() / ".blogpublisher.env",
    ]
    _ENV_FILE = next((p for p in _env_candidates if p.exists()), str(_app_dir / ".env"))
else:
    _ENV_FILE = str(Path(__file__).parent / ".env")

# Playwright 브라우저 경로 설정
# Electron이 이미 PLAYWRIGHT_BROWSERS_PATH를 주입했으면 그대로 사용,
# 아니면 OS별 시스템 캐시로 폴백.
if not os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
    _pw_cache = _get_playwright_cache_dir()
    if _pw_cache.exists():
        os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(_pw_cache)


class Settings(BaseSettings):
    # Naver
    NAVER_BLOG_ID: str = ""
    NAVER_ID: str = ""
    NAVER_PW: str = ""

    # Chrome
    CHROME_USER_DATA_DIR: str = ""

    # Database
    DB_PATH: str = ""

    # Server
    SERVER_PORT: int = 8100
    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = {
        "env_file": str(_ENV_FILE),
        "env_file_encoding": "utf-8",
    }

    @property
    def base_dir(self) -> Path:
        if getattr(sys, "frozen", False):
            return _get_app_data_dir()
        return Path(__file__).parent

    @property
    def storage_dir(self) -> Path:
        path = self.base_dir / "storage"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def images_dir(self) -> Path:
        path = self.storage_dir / "images"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def chrome_profiles_dir(self) -> Path:
        if self.CHROME_USER_DATA_DIR:
            return Path(self.CHROME_USER_DATA_DIR).resolve()
        path = _get_app_data_dir() / "storage" / "chrome_profiles"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def db_path(self) -> Path:
        if self.DB_PATH:
            return Path(self.DB_PATH).resolve()
        return self.storage_dir / "app.db"


settings = Settings()

# -*- mode: python ; coding: utf-8 -*-
"""
BlogPublisher PyInstaller 설정
- FastAPI + Uvicorn 서버를 단일 실행 파일로 번들링
- Playwright 브라우저는 번들에 포함하지 않음 (최초 실행 시 자동 다운로드)
"""

from PyInstaller.utils.hooks import collect_all, collect_submodules

# 주요 패키지 전체 수집
datas = []
binaries = []
hiddenimports = []

for pkg in ("playwright", "fastapi", "uvicorn", "pydantic", "pydantic_settings",
            "sse_starlette", "sqlalchemy", "aiofiles", "starlette"):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

# Uvicorn 관련 hidden imports (동적 import 되므로 명시 필요)
hiddenimports += collect_submodules("uvicorn")
hiddenimports += [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
]

# 프로젝트 내부 모듈
hiddenimports += [
    "server",
    "config",
    "bots.naver_blog_publisher",
    "bots.browser_engine",
    "core.markdown_converter",
    "core.forbidden_words",
    "core.image_handler",
    "db.models",
    "db.database",
    "routers.publish",
    "routers.validate",
    "routers.accounts",
]

a = Analysis(
    ["app.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "notebook", "IPython"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="BlogPublisher",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

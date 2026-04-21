"""BlogPublisher FastAPI 서버"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.database import init_db
from routers import publish, validate, accounts


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작
    init_db()
    print(f"[BlogPublisher] DB 초기화 완료: {settings.db_path}")
    yield
    # 종료 — 브라우저 정리
    from routers.publish import _browser_engine
    if _browser_engine:
        try:
            await _browser_engine.close()
        except Exception:
            pass
    print("[BlogPublisher] 서버 종료")


app = FastAPI(
    title="BlogPublisher API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — Electron(localhost:3000) + Vercel 허용
cors_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
# 추가 origin이 있으면 포함
if settings.CORS_ORIGINS:
    for origin in settings.CORS_ORIGINS.split(","):
        origin = origin.strip()
        if origin and origin not in cors_origins:
            cors_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(publish.router, prefix="/api")
app.include_router(validate.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

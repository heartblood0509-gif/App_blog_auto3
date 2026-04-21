"""네이버 계정 관리 엔드포인트"""

import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.database import get_session
from db.models import Account

router = APIRouter()


class AccountCreate(BaseModel):
    username: str
    password: str = ""
    nickname: str = ""
    blog_id: str = ""


class AccountUpdate(BaseModel):
    nickname: str | None = None
    password: str | None = None


@router.get("/accounts")
async def list_accounts():
    """네이버 계정 목록"""
    session = get_session()
    try:
        accounts = session.query(Account).filter_by(is_active=True).all()
        return [
            {
                "id": a.id,
                "username": a.username,
                "nickname": a.nickname or "",
                "blog_id": a.username,
                "is_active": a.is_active,
                "last_post_at": a.last_post_at.isoformat() if a.last_post_at else None,
            }
            for a in accounts
        ]
    finally:
        session.close()


@router.post("/accounts")
async def create_account(req: AccountCreate):
    """네이버 계정 추가"""
    session = get_session()
    try:
        # 이미 등록된 계정이면 (비활성 포함) 재활성화
        existing = session.query(Account).filter_by(username=req.username).first()
        if existing:
            if existing.is_active:
                raise HTTPException(status_code=409, detail="이미 등록된 계정입니다.")
            # 비활성 계정 재활성화
            existing.is_active = True
            existing.password = req.password
            existing.nickname = req.nickname or existing.nickname
            session.commit()
            return {
                "id": existing.id,
                "username": existing.username,
                "nickname": existing.nickname or "",
                "blog_id": req.blog_id or existing.username,
                "is_active": True,
                "last_post_at": None,
            }

        account = Account(
            id=str(uuid.uuid4()),
            username=req.username,
            nickname=req.nickname,
            password=req.password,
            platform="blog",
            is_active=True,
        )
        session.add(account)
        session.commit()

        return {
            "id": account.id,
            "username": account.username,
            "nickname": account.nickname or "",
            "blog_id": req.blog_id or req.username,
            "is_active": True,
            "last_post_at": None,
        }
    finally:
        session.close()


@router.patch("/accounts/{account_id}")
async def update_account(account_id: str, req: AccountUpdate):
    """네이버 계정 수정 (별명, 비밀번호)"""
    session = get_session()
    try:
        account = session.query(Account).filter_by(id=account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")

        if req.nickname is not None:
            account.nickname = req.nickname
        if req.password is not None:
            account.password = req.password

        session.commit()
        return {
            "id": account.id,
            "username": account.username,
            "nickname": account.nickname or "",
            "blog_id": account.username,
            "is_active": account.is_active,
            "last_post_at": account.last_post_at.isoformat() if account.last_post_at else None,
        }
    finally:
        session.close()


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: str):
    """네이버 계정 삭제"""
    session = get_session()
    try:
        account = session.query(Account).filter_by(id=account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")

        account.is_active = False
        session.commit()
        return {"status": "deleted"}
    finally:
        session.close()


@router.post("/accounts/{account_id}/test-login")
async def test_login(account_id: str):
    """네이버 로그인 테스트"""
    from bots.browser_engine import BrowserEngine

    session = get_session()
    try:
        account = session.query(Account).filter_by(id=account_id).first()
        if not account:
            raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다.")

        naver_id = account.username
        naver_pw = account.password or account.profile_path or ""
    finally:
        session.close()

    engine = BrowserEngine()
    try:
        await engine.launch()
        success = await engine.auto_login(naver_id, naver_pw)
        return {"success": success, "message": "로그인 성공" if success else "로그인 실패"}
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        await engine.close()

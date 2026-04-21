"""금칙어 검증 엔드포인트"""

from fastapi import APIRouter
from pydantic import BaseModel

from core.forbidden_words import validate_content_quality, auto_replace_forbidden

router = APIRouter()


class ValidateRequest(BaseModel):
    content: str
    keyword: str = ""


class AutoReplaceRequest(BaseModel):
    content: str


@router.post("/validate")
async def validate_content(req: ValidateRequest):
    """금칙어 + 키워드 밀도 + 클리셰 종합 검사"""
    result = validate_content_quality(req.content, req.keyword)
    return result


@router.post("/validate/auto-replace")
async def auto_replace(req: AutoReplaceRequest):
    """대체 가능한 금칙어를 자동 대체"""
    original = req.content
    replaced = auto_replace_forbidden(req.content)

    # 대체된 개수 계산
    replaced_count = 0
    for i, (a, b) in enumerate(zip(original, replaced)):
        if a != b:
            replaced_count += 1

    # 더 정확한 계산: 원본과 결과의 줄 단위 비교
    orig_lines = original.split("\n")
    repl_lines = replaced.split("\n")
    changed_lines = sum(1 for a, b in zip(orig_lines, repl_lines) if a != b)

    return {
        "content": replaced,
        "replaced_count": changed_lines,
    }

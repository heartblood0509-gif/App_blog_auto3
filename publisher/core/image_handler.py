"""base64 이미지 → 파일 변환 (웹 프론트엔드에서 받은 이미지를 Playwright 업로드용 파일로 저장)"""

import base64
import io
from pathlib import Path

from PIL import Image


def save_base64_images(
    images: list[dict],
    output_dir: Path,
) -> list[Path]:
    """base64 이미지 목록을 파일로 저장

    Args:
        images: [{"index": 0, "data": "base64...", "mimeType": "image/png", "description": "..."}]
        output_dir: 저장 디렉토리

    Returns:
        저장된 파일 경로 목록 (index 순서)
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []

    for img in sorted(images, key=lambda x: x.get("index", 0)):
        idx = img.get("index", len(paths))
        data = base64.b64decode(img["data"])
        mime = img.get("mimeType", "image/jpeg")
        ext = mime.split("/")[-1]

        # WebP → JPEG 변환 (네이버 호환성)
        if ext == "webp":
            pil_img = Image.open(io.BytesIO(data))
            path = output_dir / f"image_{idx:02d}.jpg"
            pil_img.save(str(path), "JPEG", quality=90)
        else:
            if ext == "jpeg":
                ext = "jpg"
            path = output_dir / f"image_{idx:02d}.{ext}"
            path.write_bytes(data)

        paths.append(path)

    return paths

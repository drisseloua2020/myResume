from __future__ import annotations

import mimetypes
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.models.entities import User
from app.schemas.common import UploadResponse
from app.services.activity import log_activity

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_PROFILE_PHOTO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}


def _ensure_private_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    try:
        path.chmod(0o700)
    except OSError:
        pass


def _safe_profile_filename(filename: str) -> str:
    clean = Path(filename).name
    if clean != filename or not clean.startswith("profile-") or Path(clean).suffix.lower() not in set(ALLOWED_PROFILE_PHOTO_TYPES.values()):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return clean


def _profile_photo_response(user_id: str, filename: str) -> FileResponse:
    clean_filename = _safe_profile_filename(filename)
    user_upload_dir = (settings.upload_root / "profile-photos" / user_id).resolve()
    target = (user_upload_dir / clean_filename).resolve()

    if user_upload_dir not in target.parents or not target.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    media_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    return FileResponse(
        target,
        media_type=media_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.post("/profile-photo", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadResponse:
    content_type = (file.content_type or "").lower()
    extension = ALLOWED_PROFILE_PHOTO_TYPES.get(content_type)
    if not extension:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported profile photo formats: JPEG, PNG, WEBP, HEIC.",
        )

    content = await file.read(settings.max_profile_photo_bytes + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
    if len(content) > settings.max_profile_photo_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Profile photo is too large.")

    _ensure_private_dir(settings.upload_root)
    _ensure_private_dir(settings.upload_root / "profile-photos")
    user_upload_dir = settings.upload_root / "profile-photos" / current_user.id
    _ensure_private_dir(user_upload_dir)

    filename = f"profile-{uuid4().hex}{extension}"
    target = user_upload_dir / filename
    target.write_bytes(content)
    try:
        target.chmod(0o600)
    except OSError:
        pass

    url = f"{settings.upload_url_prefix.rstrip('/')}/profile-photo/{filename}"

    log_activity(db, current_user.id, "PROFILE_PHOTO_UPLOAD", details=filename, user_name=current_user.name)
    db.commit()

    return UploadResponse(url=url, filename=filename, contentType=content_type, size=len(content))


@router.get("/profile-photo/{filename}")
def get_profile_photo(filename: str, current_user: User = Depends(get_current_user)) -> FileResponse:
    return _profile_photo_response(current_user.id, filename)


@router.get("/profile-photos/{user_id}/{filename}")
def get_legacy_profile_photo(
    user_id: str,
    filename: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return _profile_photo_response(user_id, filename)

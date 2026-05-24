from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
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

    user_upload_dir = settings.upload_root / "profile-photos" / current_user.id
    user_upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"profile-{uuid4().hex}{extension}"
    target = user_upload_dir / filename
    target.write_bytes(content)

    relative_path = Path("profile-photos") / current_user.id / filename
    url = f"{settings.upload_url_prefix.rstrip('/')}/{relative_path.as_posix()}"

    log_activity(db, current_user.id, "PROFILE_PHOTO_UPLOAD", details=filename, user_name=current_user.name)
    db.commit()

    return UploadResponse(url=url, filename=filename, contentType=content_type, size=len(content))

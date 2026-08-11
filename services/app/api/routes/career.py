from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user, get_db
from app.models.entities import Achievement, JobApplication, Resume, ResumeShare, ResumeVersion, User
from app.schemas.career import (
    AchievementOut,
    AchievementsEnvelope,
    AnalyzeCareerIn,
    AnalyzeCareerOut,
    CareerAnalyticsOut,
    CareerFeatureCatalogOut,
    CreateAchievementIn,
    CreateJobApplicationIn,
    CreateResumeShareIn,
    CreateResumeVersionIn,
    ExportResumeIn,
    ExportResumeOut,
    JobApplicationEnvelope,
    JobApplicationOut,
    JobApplicationsEnvelope,
    LinkedInImportIn,
    LinkedInImportOut,
    ResumeShareEnvelope,
    ResumeShareOut,
    ResumeVersionOut,
    ResumeVersionsEnvelope,
    UpdateJobApplicationIn,
)
from app.schemas.common import OkResponse
from app.services.activity import log_activity, new_prefixed_id
from app.services.career_tools import (
    analytics_for_jobs,
    analyze_resume_against_job,
    create_resume_exports,
    default_packet,
    feature_catalog,
    import_linkedin_profile,
    parse_job_description,
    slugify,
)

router = APIRouter(prefix="/career", tags=["career"])


def _job_out(job: JobApplication) -> JobApplicationOut:
    return JobApplicationOut(
        id=job.id,
        status=job.status,
        title=job.title,
        company=job.company,
        jobUrl=job.job_url,
        jobDescription=job.job_description,
        location=job.location,
        salary=job.salary,
        contactName=job.contact_name,
        contactEmail=job.contact_email,
        notes=job.notes,
        deadline=job.deadline,
        resumeId=job.resume_id,
        coverLetterId=job.cover_letter_id,
        packet=job.packet,
        reminders=job.reminders,
        savedAnswers=job.saved_answers,
        createdAt=job.created_at,
        updatedAt=job.updated_at,
    )


def _achievement_out(item: Achievement) -> AchievementOut:
    return AchievementOut(
        id=item.id,
        title=item.title,
        category=item.category,
        content=item.content,
        tags=item.tags,
        metrics=item.metrics,
        sourceResumeId=item.source_resume_id,
        createdAt=item.created_at,
    )


def _version_out(item: ResumeVersion) -> ResumeVersionOut:
    return ResumeVersionOut(
        id=item.id,
        resumeId=item.resume_id,
        jobApplicationId=item.job_application_id,
        kind=item.kind,
        title=item.title,
        locale=item.locale,
        content=item.content,
        changeSummary=item.change_summary,
        createdAt=item.created_at,
    )


def _share_out(item: ResumeShare) -> ResumeShareOut:
    return ResumeShareOut(
        id=item.id,
        resumeId=item.resume_id,
        slug=item.slug,
        isPublic=item.is_public,
        redactPii=item.redact_pii,
        metadata=item.metadata_json,
        createdAt=item.created_at,
    )


@router.post("/analyze", response_model=AnalyzeCareerOut)
def analyze(payload: AnalyzeCareerIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AnalyzeCareerOut:
    report = analyze_resume_against_job(
        payload.resumeJson,
        payload.jobDescription,
        payload.jobUrl,
        country=payload.targetCountry or "US",
        language=payload.targetLanguage or "en",
    )
    log_activity(db, current_user.id, "CAREER_ANALYZE", details=f"ATS score: {report['atsScore']}", user_name=current_user.name)
    db.commit()
    return AnalyzeCareerOut(report=report)


@router.post("/exports/resume", response_model=ExportResumeOut)
def export_resume(payload: ExportResumeIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ExportResumeOut:
    exports = create_resume_exports(payload.resumeJson, payload.title, payload.publicProfileUrl, redact_pii=payload.redactPii)
    log_activity(db, current_user.id, "CAREER_EXPORT", details=f"Title: {payload.title or 'resume'}", user_name=current_user.name)
    db.commit()
    return ExportResumeOut(exports=exports)


@router.post("/import/linkedin", response_model=LinkedInImportOut)
def import_linkedin(payload: LinkedInImportIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> LinkedInImportOut:
    result = import_linkedin_profile(payload.profileText)
    log_activity(db, current_user.id, "CAREER_LINKEDIN_IMPORT", details="Imported pasted LinkedIn profile text", user_name=current_user.name)
    db.commit()
    return LinkedInImportOut(**result)


@router.get("/features", response_model=CareerFeatureCatalogOut)
def features() -> CareerFeatureCatalogOut:
    return CareerFeatureCatalogOut(features=feature_catalog())


@router.post("/jobs", response_model=JobApplicationEnvelope, status_code=status.HTTP_201_CREATED)
def create_job(payload: CreateJobApplicationIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> JobApplicationEnvelope:
    parsed = parse_job_description(payload.jobDescription, payload.jobUrl)
    title = payload.title or parsed["title"]
    company = payload.company or parsed.get("company")
    job = JobApplication(
        id=new_prefixed_id("job"),
        user_id=current_user.id,
        status=payload.status,
        title=title,
        company=company,
        job_url=payload.jobUrl,
        job_description=payload.jobDescription,
        location=payload.location or parsed.get("location"),
        salary=payload.salary or parsed.get("salary"),
        contact_name=payload.contactName,
        contact_email=payload.contactEmail,
        notes=payload.notes,
        deadline=payload.deadline,
        resume_id=payload.resumeId,
        cover_letter_id=payload.coverLetterId,
        packet=payload.packet or default_packet({"title": title, "company": company, "jobDescription": payload.jobDescription}, payload.resumeId, payload.coverLetterId, payload.notes),
        reminders=payload.reminders or [],
        saved_answers=payload.savedAnswers or [],
    )
    db.add(job)
    db.flush()
    log_activity(db, current_user.id, "CAREER_JOB_SAVE", details=f"{title} ({job.status})", user_name=current_user.name)
    db.commit()
    db.refresh(job)
    return JobApplicationEnvelope(job=_job_out(job))


@router.get("/jobs", response_model=JobApplicationsEnvelope)
def list_jobs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> JobApplicationsEnvelope:
    rows = db.scalars(select(JobApplication).where(JobApplication.user_id == current_user.id).order_by(desc(JobApplication.updated_at), desc(JobApplication.created_at))).all()
    return JobApplicationsEnvelope(jobs=[_job_out(row) for row in rows])


@router.patch("/jobs/{job_id}", response_model=JobApplicationEnvelope)
def update_job(job_id: str, payload: UpdateJobApplicationIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> JobApplicationEnvelope:
    job = db.scalar(select(JobApplication).where(JobApplication.user_id == current_user.id, JobApplication.id == job_id))
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    mapping = {
        "status": "status",
        "title": "title",
        "company": "company",
        "jobUrl": "job_url",
        "jobDescription": "job_description",
        "location": "location",
        "salary": "salary",
        "contactName": "contact_name",
        "contactEmail": "contact_email",
        "notes": "notes",
        "deadline": "deadline",
        "resumeId": "resume_id",
        "coverLetterId": "cover_letter_id",
        "packet": "packet",
        "reminders": "reminders",
        "savedAnswers": "saved_answers",
    }
    values = payload.model_dump(exclude_unset=True)
    for source, target in mapping.items():
        if source in values:
            setattr(job, target, values[source])
    log_activity(db, current_user.id, "CAREER_JOB_UPDATE", details=f"{job.title} ({job.status})", user_name=current_user.name)
    db.commit()
    db.refresh(job)
    return JobApplicationEnvelope(job=_job_out(job))


@router.delete("/jobs/{job_id}", response_model=OkResponse)
def delete_job(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    job = db.scalar(select(JobApplication).where(JobApplication.user_id == current_user.id, JobApplication.id == job_id))
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    db.delete(job)
    db.commit()
    return OkResponse(ok=True)


@router.get("/jobs/analytics", response_model=CareerAnalyticsOut)
def job_analytics(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CareerAnalyticsOut:
    rows = db.scalars(select(JobApplication).where(JobApplication.user_id == current_user.id)).all()
    return CareerAnalyticsOut(analytics=analytics_for_jobs(rows))


@router.post("/achievements", response_model=AchievementsEnvelope, status_code=status.HTTP_201_CREATED)
def create_achievement(payload: CreateAchievementIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AchievementsEnvelope:
    item = Achievement(
        id=new_prefixed_id("ach"),
        user_id=current_user.id,
        title=payload.title,
        category=payload.category,
        content=payload.content,
        tags=payload.tags or [],
        metrics=payload.metrics,
        source_resume_id=payload.sourceResumeId,
    )
    db.add(item)
    db.flush()
    log_activity(db, current_user.id, "CAREER_ACHIEVEMENT_SAVE", details=payload.title, user_name=current_user.name)
    db.commit()
    return list_achievements(current_user, db)


@router.get("/achievements", response_model=AchievementsEnvelope)
def list_achievements(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AchievementsEnvelope:
    rows = db.scalars(select(Achievement).where(Achievement.user_id == current_user.id).order_by(desc(Achievement.created_at))).all()
    return AchievementsEnvelope(achievements=[_achievement_out(row) for row in rows])


@router.post("/resume-versions", response_model=ResumeVersionsEnvelope, status_code=status.HTTP_201_CREATED)
def create_version(payload: CreateResumeVersionIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ResumeVersionsEnvelope:
    item = ResumeVersion(
        id=new_prefixed_id("ver"),
        user_id=current_user.id,
        resume_id=payload.resumeId,
        job_application_id=payload.jobApplicationId,
        kind=payload.kind,
        title=payload.title,
        locale=payload.locale,
        content=payload.content,
        change_summary=payload.changeSummary,
    )
    db.add(item)
    db.flush()
    log_activity(db, current_user.id, "CAREER_VERSION_SAVE", details=payload.title, user_name=current_user.name)
    db.commit()
    return list_versions(current_user, db)


@router.get("/resume-versions", response_model=ResumeVersionsEnvelope)
def list_versions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ResumeVersionsEnvelope:
    rows = db.scalars(select(ResumeVersion).where(ResumeVersion.user_id == current_user.id).order_by(desc(ResumeVersion.created_at))).all()
    return ResumeVersionsEnvelope(versions=[_version_out(row) for row in rows])


@router.post("/resume-versions/{version_id}/restore", response_model=OkResponse)
def restore_version(version_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    version = db.scalar(select(ResumeVersion).where(ResumeVersion.user_id == current_user.id, ResumeVersion.id == version_id))
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if not version.resume_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Version is not linked to a saved resume")
    resume = db.scalar(select(Resume).where(Resume.user_id == current_user.id, Resume.id == version.resume_id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked resume not found")
    resume.content = version.content
    resume.title = version.title
    log_activity(db, current_user.id, "CAREER_VERSION_RESTORE", details=version.title, user_name=current_user.name)
    db.commit()
    return OkResponse(ok=True)


@router.post("/shares", response_model=ResumeShareEnvelope, status_code=status.HTTP_201_CREATED)
def create_share(payload: CreateResumeShareIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ResumeShareEnvelope:
    resume = db.scalar(select(Resume).where(Resume.user_id == current_user.id, Resume.id == payload.resumeId))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    slug = f"{slugify(resume.title)}-{new_prefixed_id('share')[-8:]}"
    share = ResumeShare(
        id=new_prefixed_id("share"),
        user_id=current_user.id,
        resume_id=payload.resumeId,
        slug=slug,
        is_public=payload.isPublic,
        redact_pii=payload.redactPii,
        metadata_json=payload.metadata or {},
    )
    db.add(share)
    db.flush()
    log_activity(db, current_user.id, "CAREER_SHARE_CREATE", details=slug, user_name=current_user.name)
    db.commit()
    db.refresh(share)
    return ResumeShareEnvelope(share=_share_out(share))


@router.get("/data-export", response_model=dict)
def data_export(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, object]:
    jobs = db.scalars(select(JobApplication).where(JobApplication.user_id == current_user.id)).all()
    achievements = db.scalars(select(Achievement).where(Achievement.user_id == current_user.id)).all()
    versions = db.scalars(select(ResumeVersion).where(ResumeVersion.user_id == current_user.id)).all()
    return {
        "jobs": [_job_out(job).model_dump(mode="json") for job in jobs],
        "achievements": [_achievement_out(item).model_dump(mode="json") for item in achievements],
        "resumeVersions": [_version_out(item).model_dump(mode="json") for item in versions],
        "privacy": {"noLlmCalls": True, "deleteEndpoint": "/career/data"},
    }


@router.delete("/data", response_model=OkResponse)
def delete_career_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    for model in (JobApplication, Achievement, ResumeVersion, ResumeShare):
        rows = db.scalars(select(model).where(model.user_id == current_user.id)).all()
        for row in rows:
            db.delete(row)
    log_activity(db, current_user.id, "CAREER_DATA_DELETE", details="Deleted career toolkit records", user_name=current_user.name)
    db.commit()
    return OkResponse(ok=True)

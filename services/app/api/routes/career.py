from __future__ import annotations

from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse

from app.api.deps import get_current_user, get_db
from app.models.entities import Achievement, CareerOnboardingProfile, CareerProfileAnalysis, CoverLetter, JobApplication, Resume, ResumeShare, ResumeVersion, User
from datetime import datetime, timezone
from hashlib import sha256
import json
from typing import Literal
from pydantic import BaseModel
from app.schemas.career import (
    AchievementOut,
    AchievementsEnvelope,
    AnalyzeCareerIn,
    AnalyzeCareerOut,
    CareerAnalyticsOut,
    CareerFeatureCatalogOut,
    CareerOnboardingProfileEnvelope,
    CareerOnboardingProfileIn,
    CareerOnboardingProfileOut,
    CareerProfileAnalysisEnvelope,
    CareerProfileAnalysisOut,
    CreateAchievementIn,
    CreateJobApplicationIn,
    CreateResumeShareIn,
    CreateResumeVersionIn,
    ExportResumeIn,
    ExportResumeOut,
    GenerateCareerProfileAnalysisIn,
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
    analyze_profile_from_onboarding,
    analyze_resume_against_job,
    create_resume_exports,
    default_packet,
    feature_catalog,
    import_linkedin_profile,
    parse_job_description,
    slugify,
    resume_to_text,
)

router = APIRouter(prefix="/career", tags=["career"])


def _owned(db, model, record_id, user_id):
    if record_id is None:
        return None
    record = db.scalar(select(model).where(model.id == record_id, model.user_id == user_id))
    if not record:
        raise HTTPException(404, "Linked record not found")
    return record


def _check_job_links(db, user_id, resume_id, letter_id):
    _owned(db, Resume, resume_id, user_id)
    _owned(db, CoverLetter, letter_id, user_id)


def _content_hash(content):
    return sha256(json.dumps(content, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


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


def _onboarding_profile_out(item: CareerOnboardingProfile) -> CareerOnboardingProfileOut:
    return CareerOnboardingProfileOut(
        id=item.id,
        userId=item.user_id,
        currentExperience=item.current_experience,
        strengths=item.strengths,
        targetRoles=item.target_roles,
        marketStatus=item.market_status,
        shortTermGoal=item.short_term_goal,
        futureGoal=item.future_goal,
        jobPreferences=item.job_preferences,
        supportNeeds=item.support_needs,
        createdAt=item.created_at,
        updatedAt=item.updated_at,
    )


def _onboarding_profile_answers(item: CareerOnboardingProfile) -> dict[str, str]:
    return {
        "currentExperience": item.current_experience,
        "strengths": item.strengths,
        "targetRoles": item.target_roles,
        "marketStatus": item.market_status,
        "shortTermGoal": item.short_term_goal,
        "futureGoal": item.future_goal,
        "jobPreferences": item.job_preferences,
        "supportNeeds": item.support_needs,
    }


def _profile_analysis_out(item: CareerProfileAnalysis, stale: bool = False) -> CareerProfileAnalysisOut:
    return CareerProfileAnalysisOut(
        stale=stale,
        id=item.id,
        userId=item.user_id,
        onboardingProfileId=item.onboarding_profile_id,
        resumeId=item.resume_id,
        profileCategory=item.profile_category,
        resumeCategory=item.resume_category,
        recommendedJobFamily=item.recommended_job_family,
        skillFocus=item.skill_focus,
        analysis=item.analysis if isinstance(item.analysis, dict) else {},
        createdAt=item.created_at,
        updatedAt=item.updated_at,
    )


@router.get("/onboarding-profile", response_model=CareerOnboardingProfileEnvelope)
def get_onboarding_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CareerOnboardingProfileEnvelope:
    profile = db.scalar(select(CareerOnboardingProfile).where(CareerOnboardingProfile.user_id == current_user.id))
    return CareerOnboardingProfileEnvelope(profile=_onboarding_profile_out(profile) if profile else None)


@router.put("/onboarding-profile", response_model=CareerOnboardingProfileEnvelope)
def save_onboarding_profile(payload: CareerOnboardingProfileIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CareerOnboardingProfileEnvelope:
    profile = db.scalar(select(CareerOnboardingProfile).where(CareerOnboardingProfile.user_id == current_user.id))
    if not profile:
        profile = CareerOnboardingProfile(
            id=new_prefixed_id("onb"),
            user_id=current_user.id,
            current_experience=payload.currentExperience,
            strengths=payload.strengths,
            target_roles=payload.targetRoles,
            market_status=payload.marketStatus,
            short_term_goal=payload.shortTermGoal,
            future_goal=payload.futureGoal,
            job_preferences=payload.jobPreferences,
            support_needs=payload.supportNeeds,
        )
        db.add(profile)
    else:
        profile.current_experience = payload.currentExperience
        profile.strengths = payload.strengths
        profile.target_roles = payload.targetRoles
        profile.market_status = payload.marketStatus
        profile.short_term_goal = payload.shortTermGoal
        profile.future_goal = payload.futureGoal
        profile.job_preferences = payload.jobPreferences
        profile.support_needs = payload.supportNeeds

    db.flush()
    log_activity(db, current_user.id, "CAREER_ONBOARDING_SAVE", details="Saved onboarding questionnaire answers", user_name=current_user.name)
    db.commit()
    db.refresh(profile)
    return CareerOnboardingProfileEnvelope(profile=_onboarding_profile_out(profile))


@router.get("/profile-analysis", response_model=CareerProfileAnalysisEnvelope)
def get_profile_analysis(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CareerProfileAnalysisEnvelope:
    analysis = db.scalar(select(CareerProfileAnalysis).where(CareerProfileAnalysis.user_id == current_user.id))
    if not analysis:
        return CareerProfileAnalysisEnvelope(analysis=None)
    resume = db.get(Resume, analysis.resume_id) if analysis.resume_id else None
    onboarding = db.get(CareerOnboardingProfile, analysis.onboarding_profile_id) if analysis.onboarding_profile_id else None
    source = analysis.analysis.get('source', {}) if isinstance(analysis.analysis, dict) else {}
    stale = not resume or not onboarding or source.get('resumeHash') != _content_hash(resume.content) or source.get('onboardingHash') != _content_hash(_onboarding_profile_answers(onboarding))
    return CareerProfileAnalysisEnvelope(analysis=_profile_analysis_out(analysis, stale=bool(stale)))


@router.post("/profile-analysis", response_model=CareerProfileAnalysisEnvelope)
def generate_profile_analysis(payload: GenerateCareerProfileAnalysisIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CareerProfileAnalysisEnvelope:
    onboarding_profile = db.scalar(select(CareerOnboardingProfile).where(CareerOnboardingProfile.user_id == current_user.id))
    if not onboarding_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Complete the onboarding questionnaire before profile analysis.")

    resume_stmt = select(Resume).where(Resume.user_id == current_user.id)
    if payload.resumeId:
        resume_stmt = resume_stmt.where(Resume.id == payload.resumeId)
    else:
        resume_stmt = resume_stmt.order_by(desc(Resume.updated_at), desc(Resume.created_at)).limit(1)
    resume = db.scalar(resume_stmt)
    if not resume:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload or save a resume before profile analysis.")

    resume_content = resume.content if isinstance(resume.content, dict) else {}
    report = analyze_profile_from_onboarding(
        resume_content,
        _onboarding_profile_answers(onboarding_profile),
        resume_id=resume.id,
        onboarding_profile_id=onboarding_profile.id,
    )
    report.setdefault('source', {}).update({'resumeHash': _content_hash(resume.content), 'onboardingHash': _content_hash(_onboarding_profile_answers(onboarding_profile))})
    top_skill = report.get("thingsNeeded", {}).get("prioritySkills", [{}])[0].get("skill", "Role proof") if isinstance(report.get("thingsNeeded"), dict) else "Role proof"
    analysis = db.scalar(select(CareerProfileAnalysis).where(CareerProfileAnalysis.user_id == current_user.id))
    if not analysis:
        analysis = CareerProfileAnalysis(id=new_prefixed_id("cpa"), user_id=current_user.id)
        db.add(analysis)

    analysis.onboarding_profile_id = onboarding_profile.id
    analysis.resume_id = resume.id
    analysis.profile_category = report["profileCategory"]["label"]
    analysis.resume_category = report["resume"]["category"]
    analysis.recommended_job_family = report["jobTargets"]["recommendedFamily"]
    analysis.skill_focus = str(top_skill)
    analysis.analysis = report

    db.flush()
    log_activity(db, current_user.id, "CAREER_PROFILE_ANALYSIS", details=analysis.profile_category, user_name=current_user.name)
    db.commit()
    db.refresh(analysis)
    return CareerProfileAnalysisEnvelope(analysis=_profile_analysis_out(analysis))


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
    exports = create_resume_exports(payload.resumeJson, payload.title, payload.publicProfileUrl, redact_pii=payload.redactPii, format=payload.format)
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
    _check_job_links(db, current_user.id, payload.resumeId, payload.coverLetterId)
    if payload.packet and payload.packet.get("decision"):
        raise HTTPException(422, "Use the packet review endpoint")
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
    _check_job_links(db, current_user.id, values.get("resumeId"), values.get("coverLetterId"))
    if any(key in values and values[key] is None for key in ("status", "title", "jobDescription")):
        raise HTTPException(422, "Status, title and description cannot be null")
    if "packet" in values and values["packet"] and values["packet"].get("decision"):
        raise HTTPException(422, "Use the packet review endpoint")
    for source, target in mapping.items():
        if source in values:
            setattr(job, target, values[source])
    if set(values) & {"resumeId", "coverLetterId", "notes", "savedAnswers", "jobDescription", "title", "company", "jobUrl", "packet"}:
        job.packet = None
    log_activity(db, current_user.id, "CAREER_JOB_UPDATE", details=f"{job.title} ({job.status})", user_name=current_user.name)
    db.commit()
    db.refresh(job)
    return JobApplicationEnvelope(job=_job_out(job))


@router.post("/jobs/{job_id}/prepare", response_model=JobApplicationEnvelope)
def prepare_packet(job_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = _owned(db, JobApplication, job_id, current_user.id)
    resume = _owned(db, Resume, job.resume_id, current_user.id)
    letter = _owned(db, CoverLetter, job.cover_letter_id, current_user.id)
    if not resume or not job.job_description.strip():
        raise HTTPException(409, "Choose a saved resume and add a job description before preparing a packet")
    job.packet = {"id": new_prefixed_id("pkt"), "decision": "pending", "preparedAt": datetime.now(timezone.utc).isoformat(),
                  "resumeId": resume.id, "resumeTitle": resume.title, "resume": resume.content,
                  "resumeHash": _content_hash(resume.content), "coverLetter": letter.content if letter else None,
                  "answers": job.saved_answers or [], "notes": job.notes or "", "jobUrl": job.job_url,
                  "jobTitle": job.title, "company": job.company, "submitted": False}
    log_activity(db, current_user.id, "PACKET_PREPARED", details=f"Job: {job.id}", user_name=current_user.name)
    db.commit()
    return JobApplicationEnvelope(job=_job_out(job))


class PacketDecisionIn(BaseModel):
    packetId: str
    decision: Literal["approved", "rejected"]


@router.post("/jobs/{job_id}/decision", response_model=JobApplicationEnvelope)
def decide_packet(job_id: str, payload: PacketDecisionIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    job = db.scalar(select(JobApplication).where(JobApplication.id == job_id, JobApplication.user_id == current_user.id).with_for_update())
    if not job:
        raise HTTPException(404, "Job not found")
    packet = job.packet if isinstance(job.packet, dict) else {}
    if packet.get("id") != payload.packetId or packet.get("decision") != "pending":
        raise HTTPException(409, "Packet changed or has already been reviewed. Reload the queue.")
    resume = _owned(db, Resume, job.resume_id, current_user.id)
    if not resume or _content_hash(resume.content) != packet.get("resumeHash"):
        raise HTTPException(409, "Resume changed. Prepare and review a new packet.")
    job.packet = {**packet, "decision": payload.decision, "reviewedAt": datetime.now(timezone.utc).isoformat()}
    log_activity(db, current_user.id, "PACKET_REVIEWED", details=f"Job: {job.id}; decision: {payload.decision}", user_name=current_user.name)
    db.commit()
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
    _owned(db, Resume, payload.sourceResumeId, current_user.id)
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


@router.put("/achievements/{achievement_id}", response_model=AchievementsEnvelope)
def update_achievement(achievement_id: str, payload: CreateAchievementIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = _owned(db, Achievement, achievement_id, current_user.id)
    _owned(db, Resume, payload.sourceResumeId, current_user.id)
    item.title, item.content, item.category = payload.title, payload.content, payload.category
    item.tags, item.metrics, item.source_resume_id = payload.tags or [], payload.metrics, payload.sourceResumeId
    db.commit()
    return list_achievements(current_user, db)


@router.delete("/achievements/{achievement_id}", response_model=OkResponse)
def delete_achievement(achievement_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_owned(db, Achievement, achievement_id, current_user.id))
    db.commit()
    return OkResponse(ok=True)


@router.post("/resume-versions", response_model=ResumeVersionsEnvelope, status_code=status.HTTP_201_CREATED)
def create_version(payload: CreateResumeVersionIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ResumeVersionsEnvelope:
    _owned(db, Resume, payload.resumeId, current_user.id)
    _owned(db, JobApplication, payload.jobApplicationId, current_user.id)
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
    db.add(ResumeVersion(id=new_prefixed_id("ver"), user_id=current_user.id, resume_id=resume.id,
                         kind="before-restore", title=resume.title, content=resume.content, change_summary="Automatic backup before restore"))
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
    import secrets
    slug = secrets.token_urlsafe(24)
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


@router.get("/shares")
def list_shares(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(ResumeShare).where(ResumeShare.user_id == current_user.id).order_by(desc(ResumeShare.created_at))).all()
    return {"shares": [_share_out(row) for row in rows]}


@router.delete("/shares/{share_id}", response_model=OkResponse)
def revoke_share(share_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    share = _owned(db, ResumeShare, share_id, current_user.id)
    db.delete(share)
    log_activity(db, current_user.id, "RESUME_SHARE_REVOKED", details=share.id, user_name=current_user.name)
    db.commit()
    return OkResponse(ok=True)


@router.get("/public/resumes/{slug}", response_class=PlainTextResponse)
def public_resume(slug: str, db: Session = Depends(get_db)):
    from datetime import timedelta
    share = db.scalar(select(ResumeShare).where(ResumeShare.slug == slug, ResumeShare.is_public.is_(True)))
    if not share or share.created_at.replace(tzinfo=timezone.utc) + timedelta(days=30) < datetime.now(timezone.utc):
        raise HTTPException(404, "Share not found or expired")
    source = db.get(Resume, share.resume_id)
    if not source or not isinstance(source.content, dict):
        raise HTTPException(404, "Share not found")
    text = resume_to_text(source.content, redact_pii=share.redact_pii)
    return PlainTextResponse(text, headers={"X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store"})


@router.get("/data-export", response_model=dict)
def data_export(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, object]:
    onboarding_profile = db.scalar(select(CareerOnboardingProfile).where(CareerOnboardingProfile.user_id == current_user.id))
    profile_analysis = db.scalar(select(CareerProfileAnalysis).where(CareerProfileAnalysis.user_id == current_user.id))
    jobs = db.scalars(select(JobApplication).where(JobApplication.user_id == current_user.id)).all()
    achievements = db.scalars(select(Achievement).where(Achievement.user_id == current_user.id)).all()
    versions = db.scalars(select(ResumeVersion).where(ResumeVersion.user_id == current_user.id)).all()
    return {
        "onboardingProfile": _onboarding_profile_out(onboarding_profile).model_dump(mode="json") if onboarding_profile else None,
        "profileAnalysis": _profile_analysis_out(profile_analysis).model_dump(mode="json") if profile_analysis else None,
        "jobs": [_job_out(job).model_dump(mode="json") for job in jobs],
        "achievements": [_achievement_out(item).model_dump(mode="json") for item in achievements],
        "resumeVersions": [_version_out(item).model_dump(mode="json") for item in versions],
        "privacy": {"noLlmCalls": True, "deleteEndpoint": "/career/data"},
    }


@router.delete("/data", response_model=OkResponse)
def delete_career_data(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> OkResponse:
    for model in (CareerProfileAnalysis, CareerOnboardingProfile, JobApplication, Achievement, ResumeVersion, ResumeShare):
        rows = db.scalars(select(model).where(model.user_id == current_user.id)).all()
        for row in rows:
            db.delete(row)
    log_activity(db, current_user.id, "CAREER_DATA_DELETE", details="Deleted career toolkit records", user_name=current_user.name)
    db.commit()
    return OkResponse(ok=True)

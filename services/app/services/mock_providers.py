"""Deterministic provider fixtures. This module never opens network connections."""
from copy import deepcopy

MOCK_JOBS = [
    {"id": "mock-platform", "title": "[Demo] Platform Engineer", "company": "Example Systems (demo)", "location": "Remote",
     "jobUrl": "https://jobs.example.invalid/platform", "jobDescription": "Build reliable internal platforms using Python, SQL, AWS and Terraform. Collaborate with engineering teams and improve delivery automation."},
    {"id": "mock-analyst", "title": "[Demo] Data Analyst", "company": "Sample Analytics (demo)", "location": "Toronto",
     "jobUrl": "https://jobs.example.invalid/analyst", "jobDescription": "Analyze customer operations using SQL and Python. Build dashboards, validate datasets and communicate measurable findings to stakeholders."},
    {"id": "mock-customer", "title": "[Demo] Customer Success Specialist", "company": "Demo Services (demo)", "location": "Hybrid",
     "jobUrl": "https://jobs.example.invalid/customer", "jobDescription": "Support customers through onboarding, troubleshoot service issues, maintain accurate CRM records and improve customer satisfaction."},
]

PROVIDER_ACTIONS = {
    "billing": {"checkout", "cancel"}, "email": {"send"}, "jobs": {"discover", "save"},
    "profile": {"connect", "sync", "disconnect"}, "applications": {"submit"},
}


def mock_result(provider: str, action: str, *, subject: str | None, plan: str, receipt: str) -> dict:
    if provider == "jobs" and action == "discover":
        return {"jobs": deepcopy(MOCK_JOBS), "source": "Mock job board"}
    if provider == "billing":
        return {"subscriptionStatus": "active" if action == "checkout" else "canceled",
                "plan": plan if action == "checkout" else "free", "chargedAmount": 0,
                "receipt": receipt, "entitlementsChanged": False}
    if provider == "email":
        return {"recipient": "candidate@example.invalid", "subject": "Demo application reminder",
                "body": "Synthetic reminder: review your saved application packet.",
                "delivery": "simulated", "deliveredExternally": False, "receipt": receipt}
    if provider == "profile":
        result = {"source": subject, "connected": action != "disconnect"}
        if action == "sync":
            result["updates"] = [{"externalId": f"mock-{subject}-achievement-v1", "title": "Synthetic provider achievement",
                                  "description": "Demo only: completed a sample automation project. This is not your career history."}]
        return result
    if provider == "applications":
        return {"receipt": receipt, "submittedExternally": False, "delivery": "simulated"}
    return {}

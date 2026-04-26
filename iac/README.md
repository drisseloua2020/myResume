# ResumeForge – GCP Terraform (Cost-controlled, FIXED HCL)

This is a corrected version of the template that **passes `terraform init`**.

Your error was caused by using **single-line block syntax** for blocks that contain
multiple arguments or nested blocks (e.g. `replication { auto {} }`,
and `value_source { secret_key_ref { ... } }`). Terraform requires these to be
multi-line blocks.

This stack provisions:
- Cloud Run (FastAPI backend)
- Cloud SQL Postgres
- Secret Manager secrets injected into Cloud Run
- Frontend:
  - GCS static hosting (default) with cache-control headers
  - OR optional Cloud Run UI container
- Cost guardrails:
  - Cloud Run max instances / concurrency / timeout
  - Cloud SQL disk autoresize disabled by default
  - Optional Billing Budget alerts
  - Optional Cloud Logging exclusions

## Quick start
1) Copy `terraform.tfvars.example` -> `terraform.tfvars` and edit:
   - project_id, region
   - api_image
   - jwt_secret
2) `terraform init`
3) `terraform apply`

## Notes
- Cloud Run concurrency + timeout are set on the **template** block (per provider docs).
- If you enable budgets, you must provide `billing_account_id`.

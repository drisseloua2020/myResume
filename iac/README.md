# Minimal-cost GCP deployment (Cloud Run + Cloud SQL + Secret Manager)

## What I found in your `services/` folder
- Backend is a **Node.js 20 + TypeScript + Express** API.
- It expects these env vars (at least):
  - `DATABASE_URL` (PostgreSQL)
  - `JWT_SECRET`
  - `GEMINI_API_KEY`
  - Optional: `CORS_ORIGINS` (comma-separated allowlist), `SMTP_*`.

Your zip did **not** include a frontend/UI folder, so this template supports two UI deployment modes:
- `ui_deploy_mode = "cloudrun"` (default): deploy a UI container image to Cloud Run.
- `ui_deploy_mode = "bucket"`: create a public Cloud Storage bucket configured for static website hosting.
- `ui_deploy_mode = "none"`: only deploy the API.

## Why this is “minimal cost”
- **Cloud Run** scales to zero, so idle cost is near-zero.
- **Cloud SQL** is the main fixed cost. This template defaults to the cheapest shared-core tier `db-f1-micro` and HDD storage.

## Prereqs
- Terraform >= 1.5
- gcloud CLI authenticated
  - `gcloud auth login`
  - `gcloud auth application-default login`

## Quick start

### 1) Create the Artifact Registry repo (so you can push images)
From `terraform/`:

```bash
terraform init
terraform apply \
  -target=google_project_service.apis \
  -target=google_artifact_registry_repository.docker
```

### 2) Build & push the API image
From repo root:

```bash
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="us-central1"

# Configure Docker auth for Artifact Registry
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# The image URI is output by Terraform after step (1):
#   terraform output -raw api_image_uri
API_IMAGE_URI=$(cd terraform && terraform output -raw api_image_uri)

docker build -t "$API_IMAGE_URI" ./services
docker push "$API_IMAGE_URI"
```

### 3) (Optional) Build & push your UI image
Only needed if `ui_deploy_mode="cloudrun"`.

- Build your UI app (React/Vite/etc) into static files, then use a simple container to serve it (nginx is common).
- Push to the URI:

```bash
UI_IMAGE_URI=$(cd terraform && terraform output -raw ui_image_uri)
# docker build -t "$UI_IMAGE_URI" ./ui
# docker push "$UI_IMAGE_URI"
```

If you prefer static hosting, set `ui_deploy_mode = "bucket"` and upload your build output with:

```bash
# after terraform apply, use the output ui_url/bucket name
gsutil -m rsync -r ./ui/dist gs://<YOUR_UI_BUCKET>
```

### 4) Apply everything
Create `terraform.tfvars`:

```hcl
project_id    = "YOUR_PROJECT_ID"
region        = "us-central1"
app_name      = "sdlc"

gemini_api_key = "YOUR_GEMINI_KEY"

# After you know your UI URL, set it here so CORS works:
# cors_origins = ["https://...your-ui..."]
```

Then:

```bash
cd terraform
terraform apply
```

### 5) Initialize the database schema
Your repo includes `services/db/init.sql`.

Option A (fully manual):
```bash
# create a temp bucket and import, or use an existing bucket
# gcloud sql import sql <INSTANCE> gs://<BUCKET>/init.sql --database=<DB>
```

Option B (convenience): set in `terraform.tfvars`:
```hcl
init_db = true
```
Then run `terraform apply` again (requires gcloud).

## Outputs
- `api_url` – Cloud Run URL for backend
- `ui_url` – Cloud Run URL or bucket website URL, depending on `ui_deploy_mode`
- `api_image_uri` / `ui_image_uri` – where to push images


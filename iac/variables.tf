variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Cloud SQL, Artifact Registry"
  type        = string
  default     = "us-central1"
}

variable "app_name" {
  description = "Base name used for resources"
  type        = string
  default     = "sdlc"
}

# --- Container images (you build/push these) ---

variable "artifact_repo_id" {
  description = "Artifact Registry repository id (docker)"
  type        = string
  default     = "app"
}

variable "api_image_name" {
  description = "Docker image name for the API"
  type        = string
  default     = "sdlc-api"
}

variable "api_image_tag" {
  description = "Docker image tag for the API"
  type        = string
  default     = "latest"
}

variable "ui_deploy_mode" {
  description = "How to deploy the UI: cloudrun (container) or bucket (static website)."
  type        = string
  default     = "cloudrun"
  validation {
    condition     = contains(["cloudrun", "bucket", "none"], var.ui_deploy_mode)
    error_message = "ui_deploy_mode must be one of: cloudrun, bucket, none."
  }
}

variable "ui_image_name" {
  description = "Docker image name for the UI (only used when ui_deploy_mode=cloudrun)"
  type        = string
  default     = "sdlc-ui"
}

variable "ui_image_tag" {
  description = "Docker image tag for the UI (only used when ui_deploy_mode=cloudrun)"
  type        = string
  default     = "latest"
}

# --- App config / secrets ---

variable "gemini_api_key" {
  description = "Gemini API key (stored in Secret Manager)"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT secret. If empty, Terraform will generate a random one."
  type        = string
  sensitive   = true
  default     = ""
}

variable "cors_origins" {
  description = "Extra CORS origins to allow (e.g., your UI URL)."
  type        = list(string)
  default     = []
}

# Optional SMTP settings (only needed if you use email sending features)
variable "smtp_host" { type = string, default = "" }
variable "smtp_port" { type = number, default = 587 }
variable "smtp_secure" { type = bool, default = false }
variable "smtp_user" { type = string, default = "" }
variable "smtp_pass" { type = string, sensitive = true, default = "" }
variable "smtp_from" { type = string, default = "" }

# --- Cloud Run knobs (cost control) ---

variable "api_min_instances" {
  description = "Cloud Run min instances for API (0 keeps cost minimal)"
  type        = number
  default     = 0
}

variable "api_max_instances" {
  description = "Cloud Run max instances for API"
  type        = number
  default     = 3
}

variable "ui_min_instances" {
  description = "Cloud Run min instances for UI (0 keeps cost minimal)"
  type        = number
  default     = 0
}

variable "ui_max_instances" {
  description = "Cloud Run max instances for UI"
  type        = number
  default     = 2
}

variable "allow_unauthenticated" {
  description = "If true, grants roles/run.invoker to allUsers (public service)."
  type        = bool
  default     = true
}

variable "deletion_protection" {
  description = "Set true in production. Keeps Terraform from deleting Cloud Run services."
  type        = bool
  default     = false
}

# --- Database (Cloud SQL) ---

variable "db_enabled" {
  description = "Create Cloud SQL Postgres and wire DATABASE_URL automatically"
  type        = bool
  default     = true
}

variable "database_url" {
  description = "If db_enabled=false, provide your own DATABASE_URL (stored in Secret Manager)."
  type        = string
  sensitive   = true
  default     = ""
}

variable "db_version" {
  description = "Cloud SQL Postgres version"
  type        = string
  default     = "POSTGRES_16"
}

variable "db_tier" {
  description = "Cloud SQL machine type. Cheapest shared-core types: db-f1-micro or db-g1-small."
  type        = string
  default     = "db-f1-micro"
}

variable "db_disk_type" {
  description = "PD_HDD is typically cheapest; PD_SSD faster."
  type        = string
  default     = "PD_HDD"
  validation {
    condition     = contains(["PD_HDD", "PD_SSD"], var.db_disk_type)
    error_message = "db_disk_type must be PD_HDD or PD_SSD."
  }
}

variable "db_disk_size_gb" {
  description = "Cloud SQL disk size (GB)"
  type        = number
  default     = 10
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "app"
}

variable "db_user" {
  description = "Database username"
  type        = string
  default     = "appuser"
}

variable "db_password" {
  description = "Database password. If empty, Terraform generates one."
  type        = string
  sensitive   = true
  default     = ""
}

variable "db_backup_enabled" {
  description = "Enable Cloud SQL automated backups (recommended, small additional cost)"
  type        = bool
  default     = false
}

# --- Optional: convenience deployment of UI assets to bucket ---

variable "ui_build_dir" {
  description = "Local path to built UI assets (only used when ui_deploy_mode=bucket and deploy_ui_assets=true)"
  type        = string
  default     = "../ui/dist"
}

variable "deploy_ui_assets" {
  description = "If true, runs gsutil rsync from ui_build_dir into the UI bucket (requires gsutil locally)."
  type        = bool
  default     = false
}

# --- Optional: convenience DB initialization ---

variable "init_db" {
  description = "If true, uploads db/init.sql and runs gcloud sql import (requires gcloud locally)."
  type        = bool
  default     = false
}

variable "init_sql_path" {
  description = "Path to SQL init script to import"
  type        = string
  default     = "../services/db/init.sql"
}

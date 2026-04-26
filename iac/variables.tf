variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "app_name" {
  type    = string
  default = "resumeforge"
}

variable "environment" {
  type    = string
  default = "dev"
}

# ---------------- API (Cloud Run) ----------------
variable "api_image" {
  type        = string
  description = "Container image URI for the Python API (already built & pushed)."
}

variable "api_port" {
  type        = number
  default     = 3000
  description = "Container port (and PORT env) for the API."
}

# Cost guardrails for Cloud Run
variable "api_min_instances" {
  type        = number
  default     = 0
  description = "Min instances (0 to scale to zero)."
}

variable "api_max_instances" {
  type        = number
  default     = 2
  description = "Hard cap on instances to limit spend."
}

variable "api_concurrency" {
  type        = number
  default     = 10
  description = "Max concurrent requests per instance."
}

variable "api_timeout_seconds" {
  type        = number
  default     = 60
  description = "Max request duration."
}

variable "api_cpu" {
  type    = string
  default = "1"
}

variable "api_memory" {
  type    = string
  default = "512Mi"
}

variable "allow_unauthenticated" {
  type        = bool
  default     = true
  description = "If true, grants allUsers roles/run.invoker."
}

variable "app_env" {
  type        = string
  default     = "production"
  description = "APP_ENV passed to backend."
}

variable "cors_origins" {
  type        = string
  default     = ""
  description = "Comma-separated CORS origins."
}

# ---------------- Secrets ----------------
variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "gemini_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "smtp_host" {
  type    = string
  default = ""
}

variable "smtp_port" {
  type    = number
  default = 0
}

variable "smtp_secure" {
  type    = bool
  default = false
}

variable "smtp_user" {
  type    = string
  default = ""
}

variable "smtp_pass" {
  type      = string
  sensitive = true
  default   = ""
}

variable "smtp_from" {
  type    = string
  default = ""
}

# ---------------- Database (Cloud SQL) ----------------
variable "create_db" {
  type    = bool
  default = true
}

variable "database_url" {
  type        = string
  sensitive   = true
  default     = ""
  description = "If create_db=false, provide an external DATABASE_URL."
}

variable "db_version" {
  type    = string
  default = "POSTGRES_16"
}

variable "db_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "db_disk_gb" {
  type    = number
  default = 10
}

variable "db_disk_autoresize" {
  type        = bool
  default     = false
  description = "Disable to prevent unexpected disk growth costs."
}

variable "db_backups_enabled" {
  type    = bool
  default = false
}

# ---------------- Frontend ----------------
variable "ui_mode" {
  type        = string
  default     = "gcs"
  description = "gcs | cloudrun | none"
  validation {
    condition     = contains(["gcs", "cloudrun", "none"], var.ui_mode)
    error_message = "ui_mode must be one of: gcs, cloudrun, none"
  }
}

variable "ui_dist_path" {
  type        = string
  default     = ""
  description = "Local path to built UI assets, e.g. ./ui/dist"
}

variable "ui_image" {
  type    = string
  default = ""
}

variable "ui_port" {
  type    = number
  default = 8080
}

variable "ui_max_instances" {
  type        = number
  default     = 1
  description = "Hard cap to limit frontend spend if using ui_mode=cloudrun."
}

# ---------------- Optional: Migration Job ----------------
variable "create_migration_job" {
  type    = bool
  default = false
}

# ---------------- Cost guardrails: budgets ----------------
variable "enable_budget" {
  type    = bool
  default = false
}

variable "billing_account_id" {
  type        = string
  default     = ""
  description = "Billing account ID, required if enable_budget=true."
}

variable "budget_amount_usd" {
  type    = number
  default = 25
}

variable "budget_thresholds" {
  type    = list(number)
  default = [0.5, 0.9, 1.0]
}

variable "budget_email_recipients" {
  type    = list(string)
  default = []
}

variable "disable_default_budget_recipients" {
  type    = bool
  default = false
}

variable "billing_project" {
  type    = string
  default = ""
}

variable "user_project_override" {
  type    = bool
  default = false
}

# ---------------- Cost guardrails: logging exclusions ----------------
variable "enable_log_exclusions" {
  type    = bool
  default = false
}

variable "exclude_cloud_run_request_logs_below_error" {
  type    = bool
  default = true
}

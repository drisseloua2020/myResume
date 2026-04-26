project_id = "myresumes"
region     = "us-central1"

app_name    = "resumeforge"
environment = "dev"

api_image = "us-central1-docker.pkg.dev/PROJECT/REPO/myresumes-api:latest"
api_port  = 3000

api_min_instances    = 0
api_max_instances    = 2
api_concurrency      = 10
api_timeout_seconds  = 60
api_cpu              = "1"
api_memory           = "512Mi"

jwt_secret     = "Gv7M3aE2eS0p_FS1tG1x9qWzLw8rKj4Cb2Nh0Qd"
gemini_api_key = "AIzaSyBcUrx9moplVWXZq0d20pQc76AbDVlMWX8"

cors_origins = ""

create_db          = true
database_url       = ""
db_version         = "POSTGRES_16"
db_tier            = "db-f1-micro"
db_disk_gb         = 10
db_disk_autoresize = false
db_backups_enabled = false

ui_mode      = "gcs"
ui_dist_path = ""

ui_image        = ""
ui_port         = 8080
ui_max_instances = 1

allow_unauthenticated = true
create_migration_job  = false

enable_log_exclusions = false
exclude_cloud_run_request_logs_below_error = true

clearenable_budget = false
billing_account_id = "000000-000000-000000"
budget_amount_usd = 25
budget_thresholds = [0.5, 0.9, 1.0]
budget_email_recipients = []
disable_default_budget_recipients = false

billing_project = ""
user_project_override = false

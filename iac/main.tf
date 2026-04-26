locals {
  name_prefix = "${var.app_name}-${var.environment}"
}

resource "google_project_service" "apis" {
  for_each = toset(compact([
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    var.enable_budget ? "billingbudgets.googleapis.com" : "",
    var.enable_budget && length(var.budget_email_recipients) > 0 ? "monitoring.googleapis.com" : "",
    var.enable_log_exclusions ? "logging.googleapis.com" : "",
  ]))

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# ---------------- Cloud SQL ----------------
resource "random_password" "db" {
  count   = var.create_db ? 1 : 0
  length  = 24
  special = true
}

resource "google_sql_database_instance" "pg" {
  count            = var.create_db ? 1 : 0
  name             = "${local.name_prefix}-pg"
  database_version = var.db_version
  region           = var.region

  depends_on = [google_project_service.apis]

  settings {
    tier            = var.db_tier
    disk_type       = "PD_HDD"
    disk_size       = var.db_disk_gb
    disk_autoresize = var.db_disk_autoresize

    availability_type = "ZONAL"

    backup_configuration {
      enabled = var.db_backups_enabled
    }
  }

  deletion_protection = false
}

resource "google_sql_database" "app" {
  count    = var.create_db ? 1 : 0
  name     = "appdb"
  instance = google_sql_database_instance.pg[0].name
}

resource "google_sql_user" "app" {
  count    = var.create_db ? 1 : 0
  name     = "appuser"
  instance = google_sql_database_instance.pg[0].name
  password = random_password.db[0].result
}

locals {
  cloudsql_connection_name = var.create_db ? google_sql_database_instance.pg[0].connection_name : ""
  database_url_cloudsql    = var.create_db ? "postgresql+psycopg://${google_sql_user.app[0].name}:${random_password.db[0].result}@/appdb?host=/cloudsql/${local.cloudsql_connection_name}" : ""
  database_url_effective   = var.create_db ? local.database_url_cloudsql : var.database_url
}

# ---------------- Secret Manager ----------------
resource "google_secret_manager_secret" "jwt" {
  secret_id = "${local.name_prefix}-jwt"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "jwt" {
  secret      = google_secret_manager_secret.jwt.id
  secret_data = var.jwt_secret
}

resource "google_secret_manager_secret" "gemini" {
  secret_id = "${local.name_prefix}-gemini"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "gemini" {
  secret      = google_secret_manager_secret.gemini.id
  secret_data = var.gemini_api_key
}

resource "google_secret_manager_secret" "db_url" {
  secret_id = "${local.name_prefix}-db-url"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "db_url" {
  secret      = google_secret_manager_secret.db_url.id
  secret_data = local.database_url_effective
}

resource "google_secret_manager_secret" "smtp_pass" {
  count     = var.smtp_pass != "" ? 1 : 0
  secret_id = "${local.name_prefix}-smtp-pass"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "smtp_pass" {
  count       = var.smtp_pass != "" ? 1 : 0
  secret      = google_secret_manager_secret.smtp_pass[0].id
  secret_data = var.smtp_pass
}

# ---------------- Cloud Run SA + IAM ----------------
resource "google_service_account" "run" {
  account_id   = replace("${local.name_prefix}-run", "/[^a-z0-9-]/", "-")
  display_name = "${local.name_prefix} Cloud Run SA"
  depends_on   = [google_project_service.apis]
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.run.email}"
}

resource "google_project_iam_member" "cloudsql_client" {
  count   = var.create_db ? 1 : 0
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.run.email}"
}

# ---------------- Cloud Run API (cost-capped) ----------------
resource "google_cloud_run_v2_service" "api" {
  name     = "${local.name_prefix}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  depends_on = [
    google_project_service.apis,
    google_project_iam_member.secret_accessor,
    google_project_iam_member.cloudsql_client,
  ]

  template {
    # Per provider docs, these belong to the template block:
    timeout                          = "${var.api_timeout_seconds}s"
    max_instance_request_concurrency = var.api_concurrency

    service_account = google_service_account.run.email

    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    dynamic "volumes" {
      for_each = var.create_db ? [1] : []
      content {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [local.cloudsql_connection_name]
        }
      }
    }

    containers {
      image = var.api_image

      ports {
        container_port = var.api_port
      }

      resources {
        limits = {
          cpu    = var.api_cpu
          memory = var.api_memory
        }
      }

      dynamic "volume_mounts" {
        for_each = var.create_db ? [1] : []
        content {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }

      env {
        name  = "APP_ENV"
        value = var.app_env
      }

      env {
        name  = "PORT"
        value = tostring(var.api_port)
      }

      dynamic "env" {
        for_each = var.cors_origins != "" ? [1] : []
        content {
          name  = "CORS_ORIGINS"
          value = var.cors_origins
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_url.secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = var.smtp_host != "" ? [1] : []
        content {
          name  = "SMTP_HOST"
          value = var.smtp_host
        }
      }

      dynamic "env" {
        for_each = var.smtp_port != 0 ? [1] : []
        content {
          name  = "SMTP_PORT"
          value = tostring(var.smtp_port)
        }
      }

      dynamic "env" {
        for_each = var.smtp_secure ? [1] : []
        content {
          name  = "SMTP_SECURE"
          value = "true"
        }
      }

      dynamic "env" {
        for_each = var.smtp_user != "" ? [1] : []
        content {
          name  = "SMTP_USER"
          value = var.smtp_user
        }
      }

      dynamic "env" {
        for_each = var.smtp_from != "" ? [1] : []
        content {
          name  = "SMTP_FROM"
          value = var.smtp_from
        }
      }

      dynamic "env" {
        for_each = var.smtp_pass != "" ? [1] : []
        content {
          name = "SMTP_PASS"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.smtp_pass[0].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  count    = var.allow_unauthenticated ? 1 : 0
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------- Optional migration job ----------------
resource "google_cloud_run_v2_job" "migrate" {
  count    = var.create_migration_job ? 1 : 0
  name     = "${local.name_prefix}-migrate"
  location = var.region

  template {
    template {
      service_account = google_service_account.run.email

      dynamic "volumes" {
        for_each = var.create_db ? [1] : []
        content {
          name = "cloudsql"
          cloud_sql_instance {
            instances = [local.cloudsql_connection_name]
          }
        }
      }

      containers {
        image   = var.api_image
        command = ["python", "-m", "alembic", "upgrade", "head"]

        dynamic "volume_mounts" {
          for_each = var.create_db ? [1] : []
          content {
            name       = "cloudsql"
            mount_path = "/cloudsql"
          }
        }

        env {
          name  = "APP_ENV"
          value = var.app_env
        }

        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.db_url.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }
}

# ---------------- UI: GCS static (cache controlled) ----------------
resource "google_storage_bucket" "ui" {
  count                       = var.ui_mode == "gcs" ? 1 : 0
  name                        = "${local.name_prefix}-ui-${var.project_id}"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

resource "google_storage_bucket_iam_member" "ui_public" {
  count  = var.ui_mode == "gcs" ? 1 : 0
  bucket = google_storage_bucket.ui[0].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

locals {
  ui_files_all   = var.ui_mode == "gcs" && var.ui_dist_path != "" ? fileset(var.ui_dist_path, "**") : []
  ui_files_index = [for f in local.ui_files_all : f if lower(f) == "index.html"]
  ui_files_rest  = [for f in local.ui_files_all : f if lower(f) != "index.html"]
}

resource "google_storage_bucket_object" "ui_index" {
  count  = var.ui_mode == "gcs" && length(local.ui_files_index) > 0 ? 1 : 0
  bucket = google_storage_bucket.ui[0].name
  name   = "index.html"
  source = "${var.ui_dist_path}/index.html"

  content_type  = "text/html; charset=utf-8"
  cache_control = "no-cache"
}

resource "google_storage_bucket_object" "ui_assets" {
  for_each = toset(local.ui_files_rest)

  bucket = google_storage_bucket.ui[0].name
  name   = each.value
  source = "${var.ui_dist_path}/${each.value}"

  cache_control = "public, max-age=31536000, immutable"

  content_type = lookup({
    "html"  = "text/html; charset=utf-8",
    "css"   = "text/css; charset=utf-8",
    "js"    = "application/javascript; charset=utf-8",
    "json"  = "application/json; charset=utf-8",
    "svg"   = "image/svg+xml",
    "png"   = "image/png",
    "jpg"   = "image/jpeg",
    "jpeg"  = "image/jpeg",
    "webp"  = "image/webp",
    "ico"   = "image/x-icon",
    "txt"   = "text/plain; charset=utf-8",
    "woff"  = "font/woff",
    "woff2" = "font/woff2",
  }, lower(regex("[^.]+$", each.value)), "application/octet-stream")
}

# ---------------- UI: Cloud Run container (optional) ----------------
resource "google_cloud_run_v2_service" "ui" {
  count    = var.ui_mode == "cloudrun" && var.ui_image != "" ? 1 : 0
  name     = "${local.name_prefix}-ui"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  depends_on = [google_project_service.apis]

  template {
    timeout                          = "60s"
    max_instance_request_concurrency = 50

    scaling {
      min_instance_count = 0
      max_instance_count = var.ui_max_instances
    }

    containers {
      image = var.ui_image

      ports {
        container_port = var.ui_port
      }

      env {
        name  = "PORT"
        value = tostring(var.ui_port)
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "ui_public" {
  count    = var.allow_unauthenticated && length(google_cloud_run_v2_service.ui) > 0 ? 1 : 0
  name     = google_cloud_run_v2_service.ui[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------- Logging exclusions ----------------
resource "google_logging_project_exclusion" "exclude_run_requests_below_error" {
  count   = var.enable_log_exclusions && var.exclude_cloud_run_request_logs_below_error ? 1 : 0
  name    = "${local.name_prefix}-exclude-run-requests-below-error"
  project = var.project_id

  filter      = "resource.type=\"cloud_run_revision\" AND logName=\"projects/${var.project_id}/logs/run.googleapis.com%2Frequests\" AND NOT (severity >= \"ERROR\")"
  description = "Exclude Cloud Run request logs below ERROR to reduce Logging ingestion."
  disabled    = false

  depends_on = [google_project_service.apis]
}

# ---------------- Billing budget alerts ----------------
data "google_project" "current" {
  project_id = var.project_id
}

resource "google_monitoring_notification_channel" "budget_emails" {
  provider = google-beta
  for_each = var.enable_budget ? { for i, email in var.budget_email_recipients : tostring(i) => email } : {}

  display_name = "Budget email ${each.value}"
  type         = "email"

  labels = {
    email_address = each.value
  }

  depends_on = [google_project_service.apis]
}

resource "google_billing_budget" "budget" {
  provider = google-beta
  count    = var.enable_budget ? 1 : 0

  billing_account = "billingAccounts/${var.billing_account_id}"
  display_name    = "${local.name_prefix} monthly budget"

  budget_filter {
    projects        = ["projects/${data.google_project.current.number}"]
    calendar_period = "MONTH"
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount_usd)
    }
  }

  dynamic "threshold_rules" {
    for_each = var.budget_thresholds
    content {
      threshold_percent = threshold_rules.value
      spend_basis       = "CURRENT_SPEND"
    }
  }

  all_updates_rule {
    monitoring_notification_channels = [for c in google_monitoring_notification_channel.budget_emails : c.id]
    disable_default_iam_recipients   = var.disable_default_budget_recipients
  }

  depends_on = [google_project_service.apis]
}

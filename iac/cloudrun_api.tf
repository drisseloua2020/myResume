resource "google_cloud_run_v2_service" "api" {
  name     = "${local.name_suffix}-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = var.deletion_protection

  template {
    service_account = google_service_account.run.email

    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    containers {
      image = local.api_image_uri

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "CORS_ORIGINS"
        value = local.cors_origins_csv
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "GEMINI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.gemini_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      # Optional SMTP settings
      env { name = "SMTP_HOST",   value = var.smtp_host }
      env { name = "SMTP_PORT",   value = tostring(var.smtp_port) }
      env { name = "SMTP_SECURE", value = tostring(var.smtp_secure) }
      env { name = "SMTP_USER",   value = var.smtp_user }
      env { name = "SMTP_FROM",   value = var.smtp_from }

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

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      dynamic "volume_mounts" {
        for_each = var.db_enabled ? [1] : []
        content {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }
    }

    dynamic "volumes" {
      for_each = var.db_enabled ? [1] : []
      content {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [google_sql_database_instance.db[0].connection_name]
        }
      }
    }
  }

  client = "terraform"

  depends_on = [
    google_project_service.apis,
    google_artifact_registry_repository.docker,
    google_secret_manager_secret_version.jwt_secret,
    google_secret_manager_secret_version.gemini_api_key,
    google_secret_manager_secret_version.database_url,
    google_project_iam_member.run_secret_accessor,
    google_artifact_registry_repository_iam_member.run_ar_reader
  ]
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  count    = var.allow_unauthenticated ? 1 : 0
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

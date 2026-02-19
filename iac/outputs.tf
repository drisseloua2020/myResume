output "artifact_registry_repo" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repo_name}"
  description = "Artifact Registry repo host/path"
}

output "api_image_uri" {
  value       = local.api_image_uri
  description = "Build/push your API image to this URI"
}

output "ui_image_uri" {
  value       = local.ui_image_uri
  description = "Build/push your UI image to this URI (if ui_deploy_mode=cloudrun)"
}

output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Public URL for the backend API"
}

output "ui_url" {
  value = var.ui_deploy_mode == "cloudrun" ? try(google_cloud_run_v2_service.ui[0].uri, "") : (
    var.ui_deploy_mode == "bucket" ? "http://${try(google_storage_bucket.ui[0].name, "")}.storage.googleapis.com" : ""
  )
  description = "UI URL (Cloud Run or bucket website endpoint)"
}

output "cloudsql_connection_name" {
  value       = var.db_enabled ? google_sql_database_instance.db[0].connection_name : ""
  description = "Cloud SQL instance connection name (for /cloudsql mount)"
}

output "db_name" {
  value       = var.db_enabled ? var.db_name : ""
  description = "Database name"
}

output "run_service_account" {
  value       = google_service_account.run.email
  description = "Runtime service account used by Cloud Run"
}

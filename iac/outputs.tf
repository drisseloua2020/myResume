output "api_url" {
  value = google_cloud_run_v2_service.api.uri
}

output "ui_url" {
  value = (
    var.ui_mode == "gcs" && length(google_storage_bucket.ui) > 0 ?
    "https://storage.googleapis.com/${google_storage_bucket.ui[0].name}/index.html" :
    var.ui_mode == "cloudrun" && length(google_cloud_run_v2_service.ui) > 0 ?
    google_cloud_run_v2_service.ui[0].uri :
    ""
  )
}

output "database_url_effective" {
  value     = local.database_url_effective
  sensitive = true
}

output "cloudsql_connection_name" {
  value = local.cloudsql_connection_name
}

output "migration_job_name" {
  value = length(google_cloud_run_v2_job.migrate) > 0 ? google_cloud_run_v2_job.migrate[0].name : ""
}

output "budget_name" {
  value = length(google_billing_budget.budget) > 0 ? google_billing_budget.budget[0].name : ""
}

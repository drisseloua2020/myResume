resource "google_service_account" "run" {
  account_id   = "${var.app_name}-run"
  display_name = "${var.app_name} Cloud Run runtime"

  depends_on = [google_project_service.apis]
}

# Allow runtime to connect to Cloud SQL (when enabled)
resource "google_project_iam_member" "run_cloudsql_client" {
  count   = var.db_enabled ? 1 : 0
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.run.email}"
}

# Allow runtime to read from Secret Manager
resource "google_project_iam_member" "run_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.run.email}"
}

# (Optional) Make it explicit that runtime can pull images (usually not needed in same project)
resource "google_artifact_registry_repository_iam_member" "run_ar_reader" {
  project    = var.project_id
  location   = google_artifact_registry_repository.docker.location
  repository = google_artifact_registry_repository.docker.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.run.email}"
}

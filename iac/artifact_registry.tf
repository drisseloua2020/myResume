resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = local.repo_name
  description   = "Docker images for ${var.app_name}"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

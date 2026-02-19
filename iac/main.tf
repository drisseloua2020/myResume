data "google_project" "this" {}

data "google_client_config" "this" {}

resource "random_id" "suffix" {
  byte_length = 3
}

locals {
  name_suffix = "${var.app_name}-${random_id.suffix.hex}"

  repo_name = var.artifact_repo_id

  api_image_uri = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repo_name}/${var.api_image_name}:${var.api_image_tag}"
  ui_image_uri  = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repo_name}/${var.ui_image_name}:${var.ui_image_tag}"

  # CORS allowlist: keep the app's defaults and add these
  cors_origins_csv = join(",", var.cors_origins)
}

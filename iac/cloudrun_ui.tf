resource "google_cloud_run_v2_service" "ui" {
  count    = var.ui_deploy_mode == "cloudrun" ? 1 : 0
  name     = "${local.name_suffix}-ui"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = var.deletion_protection

  template {
    service_account = google_service_account.run.email

    scaling {
      min_instance_count = var.ui_min_instances
      max_instance_count = var.ui_max_instances
    }

    containers {
      image = local.ui_image_uri

      # Common frontend env var conventions
      env { name = "VITE_API_URL",      value = google_cloud_run_v2_service.api.uri }
      env { name = "REACT_APP_API_URL", value = google_cloud_run_v2_service.api.uri }
      env { name = "API_URL",           value = google_cloud_run_v2_service.api.uri }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
      }
    }
  }

  client     = "terraform"
  depends_on = [google_cloud_run_v2_service.api]
}

resource "google_cloud_run_v2_service_iam_member" "ui_public" {
  count    = (var.ui_deploy_mode == "cloudrun" && var.allow_unauthenticated) ? 1 : 0
  name     = google_cloud_run_v2_service.ui[0].name
  location = google_cloud_run_v2_service.ui[0].location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

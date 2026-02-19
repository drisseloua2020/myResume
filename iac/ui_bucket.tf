locals {
  ui_bucket_name = lower(replace("${local.name_suffix}-ui", "_", "-"))
}

resource "google_storage_bucket" "ui" {
  count         = var.ui_deploy_mode == "bucket" ? 1 : 0
  name          = local.ui_bucket_name
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true
  public_access_prevention    = "inherited"

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html" # helps SPAs (works with the bucket website endpoint)
  }

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket_iam_member" "ui_public" {
  count  = var.ui_deploy_mode == "bucket" ? 1 : 0
  bucket = google_storage_bucket.ui[0].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# Convenience: upload the built UI with gsutil rsync
resource "terraform_data" "ui_upload" {
  count = (var.ui_deploy_mode == "bucket" && var.deploy_ui_assets) ? 1 : 0

  triggers_replace = {
    bucket = google_storage_bucket.ui[0].name
    dir    = var.ui_build_dir
  }

  provisioner "local-exec" {
    command = "gsutil -m rsync -r ${var.ui_build_dir} gs://${google_storage_bucket.ui[0].name}"
  }

  depends_on = [google_storage_bucket_iam_member.ui_public]
}

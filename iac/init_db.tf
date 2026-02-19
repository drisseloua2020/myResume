locals {
  db_import_bucket_name = lower(replace("${local.name_suffix}-dbimport", "_", "-"))
}

resource "google_storage_bucket" "db_import" {
  count         = (var.db_enabled && var.init_db) ? 1 : 0
  name          = local.db_import_bucket_name
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced" # keep private

  depends_on = [google_project_service.apis]
}

resource "google_storage_bucket_object" "init_sql" {
  count  = (var.db_enabled && var.init_db) ? 1 : 0
  name   = "init.sql"
  bucket = google_storage_bucket.db_import[0].name
  source = var.init_sql_path
}

resource "terraform_data" "import_sql" {
  count = (var.db_enabled && var.init_db) ? 1 : 0

  triggers_replace = {
    instance = google_sql_database_instance.db[0].name
    object   = google_storage_bucket_object.init_sql[0].name
    bucket   = google_storage_bucket.db_import[0].name
    db       = var.db_name
  }

  provisioner "local-exec" {
    command = "gcloud sql import sql ${google_sql_database_instance.db[0].name} gs://${google_storage_bucket.db_import[0].name}/${google_storage_bucket_object.init_sql[0].name} --database=${var.db_name} --quiet"
  }

  depends_on = [google_sql_user.app, google_storage_bucket_object.init_sql]
}

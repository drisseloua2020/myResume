resource "google_sql_database_instance" "db" {
  count            = var.db_enabled ? 1 : 0
  name             = "${local.name_suffix}-pg"
  region           = var.region
  database_version = var.db_version

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL" # cheaper than REGIONAL

    disk_type    = var.db_disk_type
    disk_size    = var.db_disk_size_gb
    disk_autoresize = true

    backup_configuration {
      enabled = var.db_backup_enabled
    }

    ip_configuration {
      ipv4_enabled = true
      require_ssl  = false
    }
  }

  deletion_protection = false

  depends_on = [google_project_service.apis]
}

resource "google_sql_database" "app" {
  count    = var.db_enabled ? 1 : 0
  name     = var.db_name
  instance = google_sql_database_instance.db[0].name
}

resource "google_sql_user" "app" {
  count    = var.db_enabled ? 1 : 0
  name     = var.db_user
  instance = google_sql_database_instance.db[0].name
  password = local.db_password_value
}

locals {
  # Cloud SQL unix socket connection string for node-postgres:
  # postgres://USER:PASSWORD@/DB?host=/cloudsql/INSTANCE_CONNECTION_NAME
  database_url_value = var.db_enabled ? (
    "postgres://${var.db_user}:${local.db_password_value}@/${var.db_name}?host=/cloudsql/${google_sql_database_instance.db[0].connection_name}"
  ) : var.database_url
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.name_suffix}-database-url"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = local.database_url_value
}

resource "random_password" "jwt" {
  count            = var.jwt_secret == "" ? 1 : 0
  length           = 48
  special          = true
  override_special = "_-#@!$%&*+?"
}

resource "random_password" "db" {
  count            = (var.db_enabled && var.db_password == "") ? 1 : 0
  length           = 24
  special          = true
  override_special = "_-#@!$%&*+?"
}

locals {
  jwt_secret_value = var.jwt_secret != "" ? var.jwt_secret : random_password.jwt[0].result
  db_password_value = var.db_password != "" ? var.db_password : (
    var.db_enabled ? random_password.db[0].result : ""
  )
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${local.name_suffix}-jwt-secret"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = local.jwt_secret_value
}

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "${local.name_suffix}-gemini-api-key"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "gemini_api_key" {
  secret      = google_secret_manager_secret.gemini_api_key.id
  secret_data = var.gemini_api_key
}

# Optional SMTP secret(s)
resource "google_secret_manager_secret" "smtp_pass" {
  count     = var.smtp_pass != "" ? 1 : 0
  secret_id = "${local.name_suffix}-smtp-pass"
  replication { auto {} }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "smtp_pass" {
  count       = var.smtp_pass != "" ? 1 : 0
  secret      = google_secret_manager_secret.smtp_pass[0].id
  secret_data = var.smtp_pass
}

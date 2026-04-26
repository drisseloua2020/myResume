provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project               = var.project_id
  region                = var.region
  billing_project       = var.billing_project != "" ? var.billing_project : var.project_id
  user_project_override = var.user_project_override
}

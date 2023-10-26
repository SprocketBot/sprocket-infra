# This file contains provider declarations

variable "digitalocean_token" {
    type = string
    description = "Token used to authenticate with DigitalOcean"
    sensitive = true
    nullable = false

}

provider "digitalocean" {
    token = var.digitalocean_token
}
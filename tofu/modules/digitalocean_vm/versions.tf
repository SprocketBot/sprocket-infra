# This file contains the provider versions that are required
terraform {
    required_providers {
        digitalocean = {
            source = "digitalocean/digitalocean"
            version = "~> 2.0"
        }
        ct = {
            source = "poseidon/ct"
        }
    }
}
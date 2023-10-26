terraform {
  required_providers {
    ct = {
      source = "poseidon/ct"

    }
    proxmox = {
      source = "Telmate/proxmox"
    }
    tailscale = {
      source = "tailscale/tailscale"
      version = "0.13.11"
    }
    consul = {
      source = "hashicorp/consul"
    }
  }
}
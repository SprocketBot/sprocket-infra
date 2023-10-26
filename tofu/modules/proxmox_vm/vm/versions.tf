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
    }
    consul = {
      source = "hashicorp/consul"
    }
  }
}
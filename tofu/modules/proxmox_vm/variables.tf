variable "proxmox_host" {
  type        = string
  description = "URL to your proxmox host (for https connection) e.g. megaman.h.hl1.io:8006"
}

variable "target_storage" {
  description = "Proxmox Storage to operate in"
  type        = string
}

variable "base_vmid" {
  description = "vmid to use as the basis for all created resources"
  type        = number
  default     = 97000
}

variable "proxmox_private_key_path" {
  description = "Private key to ssh to root"
  type        = string
  default     = "~/.ssh/id_rsa"

  sensitive = true
}

variable "vm_count" {
  description = "Number of VMs to deploy PER HOST"
  type        = number
  default     = 1
}

variable "vm_hosts" {
  description = "Array of hosts to deploy VMs on; this will be spread evenly"
  type        = list(string)
}

variable "resources" {
  type = object({
    cpus   = number,
    mem_gb = number
  })
  description = "Resources to allocate to each VM"
}

variable "agent" {
  description = "Your name"
  type        = string
}

variable "tailscale-authkey" {
  type        = string
  sensitive   = true
  description = "A reusable, ephemeral Tailscale Authkey (NOT API)"
}

variable "tailscale-apikey" {
  type        = string
  sensitive   = true
  description = "A reusable, ephemeral Tailscale API key (NOT AUTH)"
}
variable "rolypoly-username" {
  type        = string
  sensitive   = false
  description = "Your discord username"
}
variable "rolypoly-password" {
  type        = string
  sensitive   = true
  description = "The password you've set up with RolyPoly"

}

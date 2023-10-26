variable "vm_hostname" {
    description = "Hostname / VM Name for the created VM"
    type = string
}

variable "agent" {
    description = "Your name"
    type = string
}

variable "proxmox_host" {
    description = "FQDN / IPv4 for proxmox host"
    type = string
    
    sensitive = true
}

variable "proxmox_private_key_path" {
    description = "Private key to ssh to root"
    type = string
    default = "~/.ssh/id_rsa"
    
    sensitive = true
}

variable "template-vm-name" {
    description = "Source VM to clone from"
    type = string
}

variable "vmid" {
    description = "VM id for the created VM"
    type = number
}

variable "target_node" {
  description = "Node to create the VM on"
  type = string
}

variable "target_storage" {
    description = "Proxmox Storage to operate in"
    type = string
}

variable "cores" {
    description = "CPU Cores to allocate to this VM"
    type = number
}
variable "mem_gb" {
    description = "GB of memory to allocate to this VM"
    type = number
}
# TODO: Use this instead
# https://registry.terraform.io/providers/tailscale/tailscale/latest/docs/resources/tailnet_key
variable "tailscale-authkey" {
    type = string
    sensitive = true
    description = "A reusable, ephemeral Tailscale Authkey (NOT API)"
}

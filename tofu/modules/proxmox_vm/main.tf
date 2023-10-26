provider "proxmox" {
  pm_api_url  = "https://${var.proxmox_host}/api2/json"
  pm_user     = "root@pam"
  pm_password = "camtheram"
}

provider "tailscale" {
  api_key = var.tailscale-apikey
}

provider "consul" {
  address = "https://consul.spr.ocket.dev"
  # http_auth = "${var.rolypoly-username}:${var.rolypoly-password}"
}

variable "input_list" {
  type    = list(string)
  default = ["a", "b"]
}


locals {
  # This builds a map for iteration in the "vms" module definition
  # it looks like this:
  # {
  #     [host-idx]: { host, idx }
  # }
  # This lets us place n vms on each host in some set of hosts
  vm-specs = {
    for v in flatten([
      for idx in range(0, var.vm_count) : [
        for val in var.vm_hosts : {
          host : val
          idx : idx
        }
      ]
    ]) : "${v.host}-${v.idx}" => v
  }
}

data "consul_service" "nomad-server" {
  name = "nomad"
  tag = "http"
}

data "consul_service" "vault-server" {
  name = "vault"
}


output "debug" {
  value = data.consul_service.nomad-server
}

module "vms" {
  for_each = local.vm-specs

  source = "./vm"

  vm_hostname              = "sprocket-${var.agent}-${each.value.host}-${each.value.idx}"
  proxmox_host             = var.proxmox_host
  proxmox_private_key_path = var.proxmox_private_key_path
  template-vm-name         = proxmox_vm_qemu.sprocket-vm-template.name
  vmid                     = var.base_vmid + each.value.idx + 1
  target_node              = each.value.host
  target_storage           = var.target_storage
  cores                    = var.resources.cpus
  mem_gb                   = var.resources.mem_gb
  agent                    = var.agent
  tailscale-authkey        = var.tailscale-authkey
}

proxmox_host = "megaman.h.hl1.io"
proxmox_private_key_path = "~/.ssh/id_rsa"
target_storage = "TrueNas-ProxMox"
base_vmid = 200000
vm_count = 1
vm_hosts = [ "megaman" ]
resources = {
  cpus = 1
  mem_gb = 2
}
agent = "shuckle"
data "consul_service" "nomad-server" {
  name = "nomad"
  tag = "http"
}

data "consul_service" "vault-server" {
  name = "vault"
}

data "consul_service" "consul-server" {
  name = "consul"
}


data "ct_config" "ignition" {
  content = templatefile("${path.module}/../../../butane/sprocket-node.butane.yaml", {
    hostname : var.vm_hostname
  })
  pretty_print = true
  strict       = true
  snippets = [
    # Consul Client
    templatefile("${path.module}/../../../butane/consul/consul-agent.yaml", {
      # This big nasty indents the file so it fits the yaml properly
      consul-hcl = join(
        "\n          ",
        split("\n", templatefile("${path.module}/../../../butane/consul/consul.client.hcl", {
          consul = {
            ip = data.consul_service.consul-server.service[0].address,
            port = data.consul_service.consul-server.service[0].port
          }
        }))
      ),
    }),
    # Nomad Client
    templatefile("${path.module}/../../../butane/nomad/nomad-service.yaml", {
      include-vault = ""
      nomad-hcl = join(
        "\n          ",
        split("\n", templatefile("${path.module}/../../../butane/nomad/nomad.client.hcl", {
          datacenter = var.agent,
          nomad = { 
            ip = data.consul_service.nomad-server.service[0].address,
            port = data.consul_service.nomad-server.service[0].port
          },
          vault = {
            ip = data.consul_service.vault-server.service[0].address,
            port = data.consul_service.vault-server.service[0].port
          }
        
        }))
      )
    }),
    # Tailscale
    templatefile("${path.module}/../../../butane/tailscale/with-tailscale.yaml", {
      tailscale-authkey = var.tailscale-authkey
    })
  ]
}

resource "null_resource" "ignition_remote" {
  count = 1
  connection {
    type        = "ssh"
    user        = "root"
    private_key = file(var.proxmox_private_key_path)
    host        = var.proxmox_host
  }
  triggers = {
    configContent = data.ct_config.ignition.rendered
  }

  provisioner "file" {
    content     = data.ct_config.ignition.rendered
    destination = "/mnt/pve/${var.target_storage}/snippets/sproc-butane-${var.vm_hostname}"
  }
}

resource "proxmox_vm_qemu" "vm" {
  vmid        = var.vmid
  name        = var.vm_hostname
  target_node = var.target_node

  onboot   = true
  oncreate = true

  clone = var.template-vm-name

  cpu     = "kvm64"
  cores   = var.cores
  tags    = "nomad;tofu;sprocket"
  memory  = var.mem_gb * 1024
  balloon = var.mem_gb * 1024
  qemu_os = "other"
  agent   = 1
  os_type = "cloud-init"
  boot = "order=scsi0"

  args = "-fw_cfg name=opt/org.flatcar-linux/config,file=/mnt/pve/${var.target_storage}/snippets/sproc-butane-${var.vm_hostname}"

  network {
    bridge    = "vmbr0"
    firewall  = false
    link_down = false
    model     = "e1000"
  }

  lifecycle {
    ignore_changes       = [disk, network]
    replace_triggered_by = [null_resource.ignition_remote]
  }
  depends_on = [null_resource.ignition_remote]
}

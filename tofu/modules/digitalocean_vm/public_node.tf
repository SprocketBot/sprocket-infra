variable "hostname" {
  type = string
  default = "sprocket-proxy"
}
variable "tailscale-authkey" {
    type = string
    sensitive = true
    description = "A reusable, ephemeral Tailscale Authkey"
}

data "digitalocean_image" "flatcar" {
    name = "Flatcar Container Linux"
}

resource "random_password" "vault_password" {
    length = 64
    # = !@#$%&()-=+[]{}:?. Default value is true.
    override_special = "!@$%&()-=+[]{}?:."


}

data "ct_config" "ignition" {
    content = templatefile("${path.module}/../../butane/sprocket-node.butane.yaml", {
        hostname: var.hostname,
    })
    pretty_print = true
    strict = true
    snippets = [
        templatefile("${path.module}/../../butane/with-disk.yaml", {
            opt-disk-label: digitalocean_volume.public_node_persistent.filesystem_label
        }),
        templatefile("${path.module}/../../butane/vault/vault-service.yaml", {
            vault-hcl: join(
                "\n          ", 
                split("\n", templatefile("${path.module}/../../butane/vault/vault.hcl", {}))
            ),
            vault-password: random_password.vault_password.result
        }),
        templatefile("${path.module}/../../butane/consul/consul-agent.yaml", {
            # This big nasty indents the file so it fits the yaml properly
            consul-hcl: join(
                "\n          ", 
                split("\n", file("${path.module}/../../butane/consul/consul.server.hcl"))
            ),
        }),
        templatefile("${path.module}/../../butane/traefik/traefik-service.yaml", {
            static-config: join(
                "\n          ",
                split("\n", file("${path.module}/../../butane/traefik/traefik.static.yaml"))
            )
            dynamic-config: join(
                "\n          ",
                split("\n", file("${path.module}/../../butane/traefik/traefik.dynamic.yaml"))
            )
        }),
        templatefile("${path.module}/../../butane/nomad/nomad-service.yaml", {
            include-vault = "yes"
            nomad-hcl: join(
                "\n          ",
                split("\n", file("${path.module}/../../butane/nomad/nomad.server.hcl"))
            )
        }),
        templatefile("${path.module}/../../butane/tailscale/with-tailscale.yaml", {
            tailscale-authkey: var.tailscale-authkey
        })
    ]
}

# TODO: Decide if we even want to have SSH enabled
resource "digitalocean_ssh_key" "portal_sprocket" {
  name = "portal_sproc"
  public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOC4Qx8/Q9DX6JiEVhLFZlmZpw6WPUnuEMHMHGXM+e8S tofu"
}


resource "digitalocean_volume" "public_node_persistent" {
    size = 10
    name = "public-node-opt"
    region = "nyc3"
    tags = [ "tofu" ]
    initial_filesystem_label = "tofu_public_opt"
    initial_filesystem_type = "ext4"
    
    lifecycle {  
        # prevent_destroy = true
    }
}

data "digitalocean_reserved_ip" "proxy_floating_ip" {
    ip_address = "143.244.220.161"
}


resource "digitalocean_droplet" "public_node" {
    name = "sprocket-ingress"
    tags = [ "tofu" ]
    image = data.digitalocean_image.flatcar.id
    region = "nyc3"
    
    size = "s-2vcpu-2gb"
    user_data = data.ct_config.ignition.rendered
    ssh_keys = [
        digitalocean_ssh_key.portal_sprocket.id
    ]
    
    volume_ids = [
        digitalocean_volume.public_node_persistent.id
    ]
}

resource "digitalocean_reserved_ip_assignment" "public_node_ip" {
    droplet_id = digitalocean_droplet.public_node.id
    ip_address = data.digitalocean_reserved_ip.proxy_floating_ip.ip_address
}
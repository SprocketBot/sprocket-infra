data_dir = "/var/lib/nomad"
bind_addr = "0.0.0.0"
datacenter = "${datacenter}"

advertise {
    # Tailscale
    http = "{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}"
    rpc = "{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}"
    serf = "{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}"
}

server {
    enabled = false
}

client {
    enabled = true
    servers = ["http://${nomad.ip}:${nomad.port}"]
}

consul {
    address = "http://localhost:8500"
}

vault {
    enabled = true
    address = "http://${vault.ip}:${vault.port}"
}

plugin "docker" {
  config {
    allow_privileged = true
    volumes {
      enabled = true
    }
  }
}
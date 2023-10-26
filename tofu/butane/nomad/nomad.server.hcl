# Figure out how to disable rate limiting from traefik (?)

data_dir = "/opt/nomad"
bind_addr = "0.0.0.0"

advertise {
    # Tailscale
    http = "{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}"
    rpc = "{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}"
    serf = "{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}"
}


server {
    enabled = true
    bootstrap_expect = 1
}

client {
    enabled = false
}

vault {
    # TODO: How do we get the token set up?
    # token = ${vault-token}
    enabled = true
    create_from_role = "nomad"
    address = "http://localhost:8200"
}

consul {
    address = "http://localhost:8500"
}

ui {
    enabled = true

    consul {
        ui_url = "https://consul.spr.ocket.dev"
    }
    vault {
        ui_url = "https://vault.spr.ocket.dev"
    }
}
ui = true

service_registration "consul" {
    address = "127.0.0.1:8500"
    service_tags = "${join(",", [
        "traefik.enable=true",
        "traefik.http.routers.vault.rule=Host(`vault.spr.ocket.dev`)",
        "traefik.http.routers.vault.entrypoints=websecure"
    ])}"
}

storage "consul" {
    address = "127.0.0.1:8500"
    path = "vault"
}

listener "tcp" {
    # Tailscale
    address = "{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}:8200"
    # Traefik will handle https
    tls_disable = 1
}

listener "tcp" {
    # Localhost
    address = "127.0.0.1:8200"
    # Traefik will handle https
    tls_disable = 1
}

api_addr = "http://{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}:8200"

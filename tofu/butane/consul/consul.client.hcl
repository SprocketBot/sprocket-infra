datacenter = "sprocket"
server = false
data_dir = "/opt/consul"

ui_config {
    # We only need the UI on the server
    enabled = false
}

retry_join = [
    "${consul.ip}"
]

bind_addr = "{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}"

client_addr = "127.0.0.1"

datacenter = "sprocket"

data_dir = "/opt/consul"

bind_addr = "{{ GetAllInterfaces | include \"network\" \"100.64.0.0/10\" | attr \"address\" }}"

client_addr = "127.0.0.1"

ui_config {
  enabled = true
}

server = true

bootstrap = true

bootstrap_expect = 1

# encrypt = "$ {consul-encrypt}"
 
ports {
        dns = 8600
        grpc = 8502
}

connect {
        enabled = true
}
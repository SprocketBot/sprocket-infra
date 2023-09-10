listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

ui            = true
disable_mlock = true

storage "s3" {
    access_key = "{{accessKey}}"
    secret_key = "{{secretKey}}"
    bucket     = "{{bucket}}"
    endpoint   = "{{endpoint}}"
    path       = "vault_storage"
    s3_force_path_style = true
    tls_skip_verify = true
}
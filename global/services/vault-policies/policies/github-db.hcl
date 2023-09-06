path "platform" {
  capabilities = ["list"]
}

path "platform/dev/*" {
  capabilities = ["read", "list"]
}

path "platform/dev/manual/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "misc/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "database/creds/developer*" {
    capabilities = ["read", "list"]
}

path "database/roles" {
    capabilities = ["read", "list"]
}

path "database/creds/data_science*" {
    capabilities = ["read", "list"]
}

path "database/roles/data_science*" {
    capabilities = ["read", "list"]
}

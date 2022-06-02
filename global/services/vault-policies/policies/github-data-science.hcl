path "platform" {
  capabilities = ["list"]
}

path "platform/data-science/*" {
  capabilities = ["list", "read"]
}

path "platform/data-science/manual/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "misc" {
  capabilities = ["list"]
}
path "misc/data-science/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "database/creds/data_science*" {
    capabilities = ["read", "list"]
}

path "database/roles/data_science*" {
    capabilities = ["read", "list"]
}

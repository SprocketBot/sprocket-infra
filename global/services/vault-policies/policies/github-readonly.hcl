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

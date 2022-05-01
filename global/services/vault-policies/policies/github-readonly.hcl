path "platform" {
  capabilities = ["list"]
}

path "platform/dev/*" {
  capabilities = ["read", "list"]
}

path "misc/*" {
  capabilities = ["read", "list"]
}
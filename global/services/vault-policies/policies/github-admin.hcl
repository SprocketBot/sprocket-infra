path "platform/dev/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "misc/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "platform/elo*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "database/*" {
 capabilities = ["create", "read", "update", "delete", "list"]
} 

path "database/creds/developer_main" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

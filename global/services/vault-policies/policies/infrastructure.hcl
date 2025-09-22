path "infrastructure/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "infrastructure/metadata/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "database/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "infrastructure/postgres/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "infrastructure/minio/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "infrastructure/smtp" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "infrastructure/data/redis" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "auth/token/create" {
  capabilities = ["update"]
}
path "auth/token/lookup-self" {
  capabilities = ["read"]
}

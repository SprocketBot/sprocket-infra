#!/bin/bash

# Generate random passwords for infrastructure services
# These will be consistent across all layers

set -e

# Function to generate a secure random password
generate_password() {
  openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Function to generate a secure random token (longer)
generate_token() {
  openssl rand -base64 64 | tr -d "=+/" | cut -c1-50
}

echo "🔐 Generating infrastructure passwords..."

# Generate passwords for layer 2 services
REDIS_PASSWORD=$(generate_password)
MINIO_ROOT_USER="admin"
MINIO_ROOT_PASSWORD=$(generate_password)
INFLUX_ADMIN_PASSWORD=$(generate_password)
INFLUX_ADMIN_TOKEN=$(generate_token)
GRAFANA_ADMIN_PASSWORD=$(generate_password)

# Generate passwords for layer 3 services
PLATFORM_REDIS_PASSWORD=$(generate_password)
RABBITMQ_USER="admin"
RABBITMQ_PASSWORD=$(generate_password)

# Generate auth secrets
JWT_SECRET=$(generate_token)
FORWARD_AUTH_SECRET=$(generate_token)

# Create infrastructure passwords file
cat >.env.infra <<EOF
# Generated Infrastructure Passwords
# These are generated locally and used across all layers

# Layer 2 Infrastructure Services
REDIS_PASSWORD='${REDIS_PASSWORD}'
MINIO_ROOT_USER='${MINIO_ROOT_USER}'
MINIO_ROOT_PASSWORD='${MINIO_ROOT_PASSWORD}'
INFLUX_ADMIN_PASSWORD='${INFLUX_ADMIN_PASSWORD}'
INFLUX_ADMIN_TOKEN='${INFLUX_ADMIN_TOKEN}'
GRAFANA_ADMIN_PASSWORD='${GRAFANA_ADMIN_PASSWORD}'

# Layer 3 Platform Services
PLATFORM_REDIS_PASSWORD='${PLATFORM_REDIS_PASSWORD}'
RABBITMQ_USER='${RABBITMQ_USER}'
RABBITMQ_PASSWORD='${RABBITMQ_PASSWORD}'

# Auth Secrets
JWT_SECRET='${JWT_SECRET}'
FORWARD_AUTH_SECRET='${FORWARD_AUTH_SECRET}'
EOF

echo "✅ Generated infrastructure passwords in .env.infra"
echo ""
echo "These passwords will be:"
echo "  - Used to configure the services when they start"
echo "  - Used by dependent services to connect"
echo "  - Combined with your Doppler secrets in the final .env file"


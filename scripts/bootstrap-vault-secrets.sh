#!/bin/bash

set -e

# Bootstrap Vault Secrets Script
# This script populates Vault with required platform secrets from environment variables

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if VAULT_ADDR is set
if [ -z "$VAULT_ADDR" ]; then
    echo -e "${RED}Error: VAULT_ADDR environment variable is not set${NC}"
    echo "Example: export VAULT_ADDR=https://vault.yourdomain.com"
    exit 1
fi

# Check if VAULT_TOKEN is set
if [ -z "$VAULT_TOKEN" ]; then
    echo -e "${RED}Error: VAULT_TOKEN environment variable is not set${NC}"
    echo "You can find the root token in: global/services/vault/unseal-tokens/root_token.txt"
    exit 1
fi

# Determine environment (defaults to the stack name or 'sprocket')
# ENVIRONMENT="${PULUMI_STACK:-${VAULT_ENVIRONMENT:-sprocket}}"
ENVIRONMENT='sprocket'

echo -e "${GREEN}Bootstrapping Vault secrets for environment: ${ENVIRONMENT}${NC}"
echo "Vault address: $VAULT_ADDR"
echo ""

# Function to create or update a secret in Vault
create_secret() {
    local mount=$1
    local path=$2
    local json_data=$3

    echo -e "${YELLOW}Creating/updating secret at: ${mount}/${path}${NC}"

    # Use the HTTP API directly via curl to avoid CLI parsing issues
    local vault_addr="${VAULT_ADDR}"
    local vault_token="${VAULT_TOKEN}"

    # Prepare the data payload for KV v2 (needs to be wrapped in "data" field)
    local payload=$(echo "$json_data" | jq -c '{data: .}')

    # Use Vault HTTP API directly
    local response=$(curl -s -w "\n%{http_code}" \
        --header "X-Vault-Token: ${vault_token}" \
        --header "Content-Type: application/json" \
        --request POST \
        --data "$payload" \
        "${vault_addr}/v1/${mount}/data/${path}")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
        echo -e "${GREEN}✓ Successfully created/updated: ${mount}/${path}${NC}"
    else
        echo -e "${RED}✗ Failed to create/update: ${mount}/${path}${NC}"
        echo "HTTP Status: $http_code"
        echo "Response: $body"
        return 1
    fi
}

# Function to check if required env var is set
require_env() {
    local var_name=$1
    local secret_description=$2

    if [ -z "${!var_name}" ]; then
        echo -e "${RED}Error: ${var_name} is not set (required for ${secret_description})${NC}"
        exit 1
    fi
}

echo "Checking required environment variables..."
echo ""

# Check all required environment variables
require_env "GOOGLE_CLIENT_ID" "Google OAuth"
require_env "GOOGLE_CLIENT_SECRET" "Google OAuth"
require_env "DISCORD_CLIENT_ID" "Discord OAuth"
require_env "DISCORD_CLIENT_SECRET" "Discord OAuth"
require_env "EPIC_CLIENT_ID" "Epic OAuth"
require_env "EPIC_CLIENT_SECRET" "Epic OAuth"
require_env "STEAM_API_KEY" "Steam API"
require_env "BALLCHASING_API_TOKEN" "Ballchasing API"
require_env "CHATWOOT_HMAC_KEY" "Chatwoot HMAC"
require_env "MINIO_ACCESS_KEY" "MinIO root credentials"
require_env "MINIO_SECRET_KEY" "MinIO root credentials"

echo -e "${GREEN}All required environment variables are set!${NC}"
echo ""
echo "Creating secrets in Vault..."
echo ""

# The platform mount should already exist (created by layer_2 Pulumi)
# If not, you'll need to run the layer_2 Pulumi stack first

# Google OAuth
create_secret "platform" "${ENVIRONMENT}/manual/oauth/google" \
    "$(jq -n \
        --arg clientId "$GOOGLE_CLIENT_ID" \
        --arg clientSecret "$GOOGLE_CLIENT_SECRET" \
        '{clientId: ($clientId | tostring), clientSecret: ($clientSecret | tostring)}')"

# Discord OAuth
create_secret "platform" "${ENVIRONMENT}/manual/oauth/discord" \
    "$(jq -n \
        --arg client_id "$DISCORD_CLIENT_ID" \
        --arg client_secret "$DISCORD_CLIENT_SECRET" \
        '{client_id: ($client_id | tostring), client_secret: ($client_secret | tostring)}')"

# Epic OAuth
create_secret "platform" "${ENVIRONMENT}/manual/oauth/epic" \
    "$(jq -n \
        --arg clientId "$EPIC_CLIENT_ID" \
        --arg clientSecret "$EPIC_CLIENT_SECRET" \
        '{clientId: ($clientId | tostring), clientSecret: ($clientSecret | tostring)}')"

# Steam API
create_secret "platform" "${ENVIRONMENT}/manual/oauth/steam" \
    "$(jq -n \
        --arg apiKey "$STEAM_API_KEY" \
        '{apiKey: ($apiKey | tostring)}')"

# Ballchasing API (note: no environment prefix based on the error)
create_secret "platform" "ballchasing" \
    "$(jq -n \
        --arg token "$BALLCHASING_API_TOKEN" \
        '{token: ($token | tostring)}')"

# Chatwoot HMAC
create_secret "platform" "${ENVIRONMENT}/chatwoot" \
    "$(jq -n \
        --arg hmacKey "$CHATWOOT_HMAC_KEY" \
        '{hmacKey: ($hmacKey | tostring)}')"

# MinIO root credentials (infrastructure mount, not platform)
create_secret "infrastructure" "data/minio/root" \
    "$(jq -n \
        --arg username "$MINIO_ACCESS_KEY" \
        --arg password "$MINIO_SECRET_KEY" \
        '{username: ($username | tostring), password: ($password | tostring)}')"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ All secrets have been successfully bootstrapped!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "You can verify the secrets with:"
echo "  vault kv get platform/${ENVIRONMENT}/manual/oauth/google"
echo "  vault kv get platform/${ENVIRONMENT}/manual/oauth/discord"
echo "  vault kv get platform/${ENVIRONMENT}/manual/oauth/epic"
echo "  vault kv get platform/${ENVIRONMENT}/manual/oauth/steam"
echo "  vault kv get platform/ballchasing"
echo "  vault kv get platform/${ENVIRONMENT}/chatwoot"
echo "  vault kv get infrastructure/data/minio/root"

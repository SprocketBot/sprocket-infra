#!/bin/bash

# Script to generate complete .env file from Doppler + generated infrastructure passwords
# Run this locally where you have Doppler CLI authenticated

set -e

DOPPLER_PROJECT="${DOPPLER_PROJECT:-sprocket}"
DOPPLER_CONFIG="${DOPPLER_CONFIG:-prd}"

echo "🔐 Step 1: Generating infrastructure passwords..."
./generate-passwords.sh

echo ""
echo "☁️  Step 2: Downloading secrets from Doppler project: $DOPPLER_PROJECT, config: $DOPPLER_CONFIG"

# Generate .env file from Doppler
doppler secrets download --project="$DOPPLER_PROJECT" --config="$DOPPLER_CONFIG" --format=env --no-file >.env.doppler

echo ""
echo "🔗 Step 3: Combining infrastructure passwords with Doppler secrets..."

# Combine infrastructure passwords with Doppler secrets
cat .env.infra .env.doppler >.env

# Clean up temporary files
rm .env.infra .env.doppler

echo "✅ Generated complete .env file with $(wc -l <.env) environment variables"
echo ""
echo "This .env file contains:"
echo "  - Generated infrastructure passwords (Redis, MinIO, RabbitMQ, etc.)"
echo "  - Your Doppler secrets (Discord tokens, database credentials, etc.)"
echo ""
echo "Next steps:"
echo "1. Review the .env file to ensure all required variables are present"
echo "2. Copy files to your swarm manager:"
echo "   scp .env *.yml deploy.sh user@swarm-manager:~/sprocket-deployment/"
echo "3. Run the deployment script on the swarm manager"
echo ""
echo "Required variables check:"

# Check for critical variables
REQUIRED_VARS=(
  "HOSTNAME"
  "ENVIRONMENT_SUBDOMAIN"
  "IMAGE_TAG"
  "POSTGRES_HOSTNAME"
  "POSTGRES_PASSWORD"
  "POSTGRES_USERNAME"
  "POSTGRES_DATABASE"
  "POSTGRES_PORT"
  "DISCORD_CLIENT_ID"
  "DISCORD_CLIENT_SECRET"
)

for var in "${REQUIRED_VARS[@]}"; do
  if grep -q "^${var}=" .env; then
    echo "✅ $var"
  else
    echo "❌ $var (missing - add to Doppler)"
  fi
done

echo ""
echo "Generated infrastructure passwords:"
INFRA_VARS=(
  "REDIS_PASSWORD"
  "MINIO_ROOT_PASSWORD"
  "PLATFORM_REDIS_PASSWORD"
  "RABBITMQ_PASSWORD"
  "JWT_SECRET"
  "FORWARD_AUTH_SECRET"
)

for var in "${INFRA_VARS[@]}"; do
  if grep -q "^${var}=" .env; then
    echo "✅ $var (generated)"
  else
    echo "❌ $var (generation failed)"
  fi
done

#!/bin/bash

# Deployment script for Docker Swarm
# Run this on your swarm manager after copying the .env file

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo -e "${RED}❌ .env file not found!${NC}"
  echo "Please copy your .env file to this directory first:"
  echo "scp .env user@swarm-manager:~/"
  exit 1
fi

echo -e "${GREEN}🚀 Starting Sprocket Platform Deployment${NC}"
echo ""

# Source the .env file to validate
set -a
source .env
set +a

# Validate critical environment variables
echo -e "${YELLOW}📋 Validating environment variables...${NC}"
REQUIRED_VARS=(
  "HOSTNAME"
  "ENVIRONMENT_SUBDOMAIN"
  "IMAGE_TAG"
  "POSTGRES_HOST"
  "REDIS_PASSWORD"
  "MINIO_ROOT_USER"
  "MINIO_ROOT_PASSWORD"
  "DISCORD_CLIENT_ID"
  "DISCORD_CLIENT_SECRET"
  "FORWARD_AUTH_SECRET"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${RED}❌ Missing required environment variable: $var${NC}"
    exit 1
  else
    echo -e "${GREEN}✅ $var${NC}"
  fi
done

echo ""

# Deploy Layer 1 (Traefik, Auth)
echo -e "${YELLOW}🌐 Deploying Layer 1: Ingress & Authentication${NC}"
docker stack deploy -c layer_1_docker-compose.yml layer1 --detach=false

# Deploy Layer 2 (Infrastructure Services)
echo -e "${YELLOW}🗄️  Deploying Layer 2: Infrastructure Services${NC}"
docker stack deploy -c layer_2_docker-compose.yml layer2 --detach=false

# Deploy Layer 3 (Platform Services)
echo -e "${YELLOW}🚀 Deploying Layer 3: Platform Services${NC}"
docker stack deploy -c layer_3_docker-compose.yml layer3 --detach=false

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "Check deployment status:"
echo "  docker stack ls"
echo "  docker service ls"
echo ""
echo "View logs:"
echo "  docker service logs layer1_traefik"
echo "  docker service logs layer2_redis"
echo "  docker service logs layer3_sprocket-core"
echo ""
echo "Your services should be available at:"
echo "  https://traefik.${HOSTNAME} (Traefik Dashboard)"
echo "  https://${ENVIRONMENT_SUBDOMAIN}.${HOSTNAME} (Sprocket Web)"
echo "  https://api.${ENVIRONMENT_SUBDOMAIN}.${HOSTNAME} (Sprocket API)"
echo "  https://grafana.${HOSTNAME} (Grafana)"
echo "  https://minio.${HOSTNAME} (MinIO Console)"

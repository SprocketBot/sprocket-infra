# Sprocket Platform Docker Swarm Deployment

This directory contains Docker Compose files and deployment scripts for running the entire Sprocket platform on Docker Swarm.

## 🏗️ Architecture

The platform is deployed in 3 layers:

- **Layer 1**: Ingress & Authentication (Traefik, Discord OAuth)
- **Layer 2**: Infrastructure Services (Redis, MinIO, InfluxDB, Grafana, etc.)
- **Layer 3**: Platform Services (Sprocket Core, Web, Discord Bot, Microservices)

## 🚀 Quick Start

### Prerequisites

- Docker Swarm cluster with labeled nodes:
  - `node.labels.role=ingress` (for Traefik)
  - `node.labels.role=storage` (for data services)
- Doppler CLI authenticated locally
- Managed PostgreSQL instance
- DNS records pointing to your swarm

### 1. Generate Environment File (Local)

```bash
# Set your Doppler project
export DOPPLER_PROJECT="sprocket-infra"
export DOPPLER_CONFIG="production"

# Generate complete .env file
./generate-env.sh
```

This will:
- Generate secure passwords for all infrastructure services
- Download your secrets from Doppler
- Combine them into a single `.env` file

### 2. Deploy to Swarm

```bash
# Copy files to swarm manager
scp .env *.yml deploy.sh user@swarm-manager:~/sprocket-deployment/

# Deploy on swarm manager
ssh user@swarm-manager
cd ~/sprocket-deployment
./deploy.sh
```

## 📋 Required Doppler Secrets

Add these to your Doppler project (see `.env.example` for full list):

```bash
HOSTNAME=sprocket.gg
ENVIRONMENT_SUBDOMAIN=main
IMAGE_TAG=latest
POSTGRES_HOSTNAME=your-managed-db-host.com
POSTGRES_PASSWORD=your-db-password
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_BOT_TOKEN=your-bot-token
# ... and more (see .env.example)
```

## 🔐 Generated Infrastructure Passwords

These are automatically generated (don't add to Doppler):
- Redis passwords
- MinIO credentials  
- RabbitMQ passwords
- JWT secrets
- Forward auth secrets

## 🌐 Service URLs

After deployment, services are available at:

- `https://traefik.${HOSTNAME}` - Traefik dashboard
- `https://${ENVIRONMENT_SUBDOMAIN}.${HOSTNAME}` - Sprocket web app
- `https://api.${ENVIRONMENT_SUBDOMAIN}.${HOSTNAME}` - Sprocket API
- `https://grafana.${HOSTNAME}` - Grafana monitoring
- `https://minio.${HOSTNAME}` - MinIO console

## 🔧 Management Commands

```bash
# Check deployment status
docker stack ls
docker service ls

# View logs
docker service logs layer1_traefik
docker service logs layer3_sprocket-core

# Update a service
docker service update --image asaxplayinghorse/core:new-tag layer3_sprocket-core

# Remove deployment
docker stack rm layer3
docker stack rm layer2
docker stack rm layer1
```

## 📁 Files

- `layer_1_docker-compose.yml` - Traefik and authentication
- `layer_2_docker-compose.yml` - Infrastructure services
- `layer_3_docker-compose.yml` - Platform applications
- `generate-env.sh` - Creates .env from Doppler + generated passwords
- `generate-passwords.sh` - Generates infrastructure passwords
- `deploy.sh` - Deploys all layers to swarm
- `.env.example` - Shows required Doppler secrets
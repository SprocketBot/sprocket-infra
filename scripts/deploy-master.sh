#!/bin/bash
set -e

# SprocketBot Application Services Master Deployment Script
# This script orchestrates the deployment of SprocketBot Docker services
# Run this script on your Docker Swarm manager node AFTER DigitalOcean infrastructure is deployed

echo "🚀 SprocketBot Application Services Deployment"
echo "=============================================="
echo ""
echo "This script deploys SprocketBot Docker services to your existing DigitalOcean infrastructure."
echo ""
echo "Prerequisites:"
echo "• DigitalOcean infrastructure deployed (droplets, load balancer, VPC)"
echo "• Docker Swarm cluster running (workers joined)"
echo "• Domain configured to point to load balancer"
echo "• Required API tokens and credentials"
echo ""

# Check if we're on a swarm manager
if ! docker info | grep -q "Swarm: active"; then
    echo "❌ Error: Docker Swarm is not active on this node"
    echo "Please ensure the infrastructure deployment completed and workers are joined"
    exit 1
fi

if ! docker info | grep -q "Is Manager: true"; then
    echo "❌ Error: This script must be run on a Docker Swarm manager node"
    exit 1
fi

read -p "Continue with Docker services deployment? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "📋 Deployment will proceed in 2 phases:"
echo "1. Docker Infrastructure Services (Traefik, PostgreSQL, Redis, RabbitMQ, Minio)"
echo "2. SprocketBot Applications (Core API, Web Frontend, Discord Bot)"
echo ""
echo "🚀 Starting Phase 1: Docker Infrastructure Services"
echo "=================================================="

# Run Docker infrastructure deployment
if [[ -x "$SCRIPT_DIR/deploy-infrastructure.sh" ]]; then
    bash "$SCRIPT_DIR/deploy-infrastructure.sh"
else
    echo "❌ Error: deploy-infrastructure.sh not found or not executable"
    exit 1
fi

echo ""
echo "⏳ Pausing for infrastructure to stabilize..."
sleep 30

echo ""
echo "🚀 Starting Phase 2: SprocketBot Applications"
echo "============================================="

# Run application deployment
if [[ -x "$SCRIPT_DIR/deploy-applications.sh" ]]; then
    bash "$SCRIPT_DIR/deploy-applications.sh"
else
    echo "❌ Error: deploy-applications.sh not found or not executable"
    exit 1
fi

echo ""
echo "🎉 Complete SprocketBot Deployment Finished!"
echo "============================================="
echo ""
echo "Your SprocketBot platform is now fully deployed and ready to use!"
echo ""
echo "📊 Deployment Summary:"
echo "• DigitalOcean infrastructure: ✅ Already deployed"
echo "• Docker infrastructure services: ✅ Deployed"  
echo "• SprocketBot applications: ✅ Deployed"
echo "• SSL certificates: ✅ Configured"
echo "• Database: ✅ Initialized"
echo "• Object storage: ✅ Ready"
echo ""
echo "🌐 Access your platform:"
echo "========================"

# Source domain from infrastructure config if available
if [[ -f /srv/deployment-config.txt ]]; then
    source /srv/deployment-config.txt
    echo "• Main Website: https://$DOMAIN"
    echo "• API Endpoint: https://api.$DOMAIN"
    echo "• Admin Dashboard: https://traefik.$DOMAIN"
else
    echo "• Check /srv/deployment-config.txt for your URLs"
fi

echo ""
echo "📚 Useful commands:"
echo "==================="
echo "• Check services: docker service ls"
echo "• View logs: docker service logs SERVICE_NAME"
echo "• Monitor resources: docker stats"
echo "• Scale service: docker service scale SERVICE_NAME=N"
echo ""
echo "🔒 Security files (keep secure!):"
echo "=================================="
echo "• Infrastructure passwords: /srv/infrastructure-passwords.txt"
echo "• Application configuration: /srv/deployment-config.txt"
echo ""
echo "🎉 Deployment Complete! Welcome to SprocketBot on DigitalOcean!"
#!/bin/bash
set -e

echo "🌊 Setting up DigitalOcean infrastructure for SprocketBot..."

# Check required environment variables
if [ -z "$DIGITALOCEAN_TOKEN" ]; then
    echo "❌ Error: DIGITALOCEAN_TOKEN environment variable is required"
    echo "   Get your token from: https://cloud.digitalocean.com/account/api/tokens"
    exit 1
fi

if [ -z "$DOPPLER_TOKEN" ]; then
    echo "❌ Error: DOPPLER_TOKEN environment variable is required"
    echo "   Get your token from your Doppler project settings"
    exit 1
fi

# Navigate to clean DigitalOcean platform directory
cd "$(dirname "$0")/../digitalocean-platform"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Use local backend for this DigitalOcean deployment
echo "🔧 Using local Pulumi backend for DigitalOcean deployment..."
pulumi login --local

echo "📝 Configuring Pulumi stack for DigitalOcean..."

# Create or select the digitalocean stack
pulumi stack init digitalocean 2>/dev/null || pulumi stack select digitalocean

# Configure DigitalOcean provider
echo "🔑 Configuring DigitalOcean credentials..."
pulumi config set digitalocean:token --secret "$DIGITALOCEAN_TOKEN"

# Configure Doppler token
echo "🔑 Configuring Doppler credentials..."
pulumi config set doppler-token --secret "$DOPPLER_TOKEN"

# Configure basic settings
echo "⚙️  Setting up basic configuration..."
pulumi config set region nyc3
pulumi config set manager-size s-4vcpu-8gb
pulumi config set worker-size s-2vcpu-4gb
pulumi config set worker-count 2

# Prompt for required secrets
echo ""
echo "🔐 Please configure the following secrets:"
echo ""

read -s -p "Enter Discord Bot Token: " DISCORD_BOT_TOKEN
echo ""
pulumi config set discord-bot-token --secret "$DISCORD_BOT_TOKEN"

read -s -p "Enter Docker Registry Access Token: " DOCKER_TOKEN
echo ""
pulumi config set docker-access-token --secret "$DOCKER_TOKEN"

echo ""
echo "✅ Basic configuration complete!"
echo ""
echo "🔍 Current configuration:"
pulumi config
echo ""
echo "📋 Next steps:"
echo "   1. Deploy infrastructure: pulumi up"
echo "   2. After deployment, update DNS to point to the load balancer IP"
echo "   3. Join worker nodes to Docker Swarm (instructions will be provided)"
echo ""
echo "⚠️  Important notes:"
echo "   - This creates a standalone DigitalOcean deployment"
echo "   - Worker nodes will need manual join to Docker Swarm after deployment"
echo "   - Monitor the deployment logs for any issues"
echo ""
echo "🚀 Ready to deploy! Run 'pulumi up' when ready."
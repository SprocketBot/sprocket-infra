#!/bin/bash
set -e

# SprocketBot Applications Deployment Script
# This script deploys the SprocketBot applications (Core API, Web, Discord Bot)
# Run this script on your Docker Swarm manager node AFTER deploy-infrastructure.sh

echo "🚀 SprocketBot Applications Deployment"
echo "======================================"
echo ""

# Check prerequisites
if [[ ! -f /srv/infrastructure-passwords.txt ]]; then
    echo "❌ Error: Infrastructure passwords file not found"
    echo "Please run ./deploy-infrastructure.sh first"
    exit 1
fi

if ! docker service ls | grep -q traefik_traefik; then
    echo "❌ Error: Traefik not running"
    echo "Please run ./deploy-infrastructure.sh first"
    exit 1
fi

# Source infrastructure passwords
source <(grep -E '^[^#]' /srv/infrastructure-passwords.txt | sed 's/: /=/' | sed 's/ /_/g')

echo "📝 Application Configuration"
echo "============================"
echo ""

# Check if Doppler CLI is available
if ! command -v doppler &> /dev/null; then
    echo "📦 Installing Doppler CLI..."
    curl -Ls https://cli.doppler.com/install.sh | sh
fi

# Get configuration from Doppler
echo "🔑 Configuring Doppler..."

# Set Doppler token if provided via environment
if [[ -n "$DOPPLER_TOKEN" ]]; then
    export DOPPLER_TOKEN="$DOPPLER_TOKEN"
fi

# Configure Doppler project and environment if not already set
if [[ -z "$(doppler configure get project.name 2>/dev/null)" ]]; then
    echo "📋 Available Doppler projects:"
    doppler projects list 2>/dev/null || echo "❌ Could not list projects. Check your DOPPLER_TOKEN."
    echo ""
    read -p "Enter your Doppler project name: " DOPPLER_PROJECT
    read -p "Enter your Doppler environment (e.g., production): " DOPPLER_ENV
    
    doppler configure set project "$DOPPLER_PROJECT"
    doppler configure set config "$DOPPLER_ENV"
    echo "✅ Doppler configured for project: $DOPPLER_PROJECT, environment: $DOPPLER_ENV"
else
    DOPPLER_PROJECT=$(doppler configure get project.name)
    DOPPLER_ENV=$(doppler configure get config.name)
    echo "✅ Using existing Doppler configuration: $DOPPLER_PROJECT / $DOPPLER_ENV"
fi

# Get domain (prompt only for this one since it's deployment-specific)
if [[ -f /srv/deployment-config.txt ]]; then
    echo "Loading existing domain configuration..."
    source /srv/deployment-config.txt
else
    read -p "Enter your domain (e.g., sprocketbot.gg): " DOMAIN
    echo "DOMAIN=\"$DOMAIN\"" > /srv/deployment-config.txt
    chmod 600 /srv/deployment-config.txt
fi

# Fetch secrets from Doppler
echo "🔍 Fetching application secrets from Doppler..."
DISCORD_BOT_TOKEN=$(doppler secrets get DISCORD_BOT_TOKEN --plain 2>/dev/null || echo "")
DISCORD_CLIENT_ID=$(doppler secrets get DISCORD_CLIENT_ID --plain 2>/dev/null || echo "")
DISCORD_CLIENT_SECRET=$(doppler secrets get DISCORD_CLIENT_SECRET --plain 2>/dev/null || echo "")
GOOGLE_CLIENT_ID=$(doppler secrets get GOOGLE_CLIENT_ID --plain 2>/dev/null || echo "")
GOOGLE_CLIENT_SECRET=$(doppler secrets get GOOGLE_CLIENT_SECRET --plain 2>/dev/null || echo "")
EPIC_CLIENT_ID=$(doppler secrets get EPIC_CLIENT_ID --plain 2>/dev/null || echo "")
EPIC_CLIENT_SECRET=$(doppler secrets get EPIC_CLIENT_SECRET --plain 2>/dev/null || echo "")
STEAM_API_KEY=$(doppler secrets get STEAM_API_KEY --plain 2>/dev/null || echo "")
BALLCHASING_API_TOKEN=$(doppler secrets get BALLCHASING_API_TOKEN --plain 2>/dev/null || echo "")
CHATWOOT_HMAC_KEY=$(doppler secrets get CHATWOOT_HMAC_KEY --plain 2>/dev/null || echo "")
CHATWOOT_WEBSITE_TOKEN=$(doppler secrets get CHATWOOT_WEBSITE_TOKEN --plain 2>/dev/null || echo "")

# Generate JWT secret if not in Doppler
JWT_SECRET=$(doppler secrets get JWT_SECRET --plain 2>/dev/null || openssl rand -base64 64)

# Verify required secrets
if [[ -z "$DISCORD_BOT_TOKEN" ]]; then
    echo "❌ Error: DISCORD_BOT_TOKEN not found in Doppler"
    exit 1
fi

if [[ -z "$DISCORD_CLIENT_ID" ]] || [[ -z "$DISCORD_CLIENT_SECRET" ]]; then
    echo "❌ Error: Discord OAuth credentials not found in Doppler"
    exit 1
fi

echo "✅ Secrets fetched from Doppler"

echo ""
echo "Using domain: $DOMAIN"
echo ""

# Create application secrets
echo "🔑 Creating application secrets..."

echo "$JWT_SECRET" | docker secret create jwt-secret - 2>/dev/null || echo "Secret jwt-secret already exists"
echo "$DISCORD_BOT_TOKEN" | docker secret create discord-bot-token - 2>/dev/null || echo "Secret discord-bot-token already exists"
echo "$DISCORD_CLIENT_ID" | docker secret create discord-client-id - 2>/dev/null || echo "Secret discord-client-id already exists"
echo "$DISCORD_CLIENT_SECRET" | docker secret create discord-client-secret - 2>/dev/null || echo "Secret discord-client-secret already exists"
echo "$GOOGLE_CLIENT_ID" | docker secret create google-client-id - 2>/dev/null || echo "Secret google-client-id already exists"
echo "$GOOGLE_CLIENT_SECRET" | docker secret create google-client-secret - 2>/dev/null || echo "Secret google-client-secret already exists"

if [[ -n "$EPIC_CLIENT_ID" ]]; then
    echo "$EPIC_CLIENT_ID" | docker secret create epic-client-id - 2>/dev/null || echo "Secret epic-client-id already exists"
fi
if [[ -n "$EPIC_CLIENT_SECRET" ]]; then
    echo "$EPIC_CLIENT_SECRET" | docker secret create epic-client-secret - 2>/dev/null || echo "Secret epic-client-secret already exists"
fi
if [[ -n "$STEAM_API_KEY" ]]; then
    echo "$STEAM_API_KEY" | docker secret create steam-api-key - 2>/dev/null || echo "Secret steam-api-key already exists"
fi
if [[ -n "$BALLCHASING_API_TOKEN" ]]; then
    echo "$BALLCHASING_API_TOKEN" | docker secret create ballchasing-api-token - 2>/dev/null || echo "Secret ballchasing-api-token already exists"
fi
if [[ -n "$CHATWOOT_HMAC_KEY" ]]; then
    echo "$CHATWOOT_HMAC_KEY" | docker secret create chatwoot-hmac-key - 2>/dev/null || echo "Secret chatwoot-hmac-key already exists"
fi

# Minio access credentials
echo "sprocketbot" | docker secret create minio-access-key - 2>/dev/null || echo "Secret minio-access-key already exists"
echo "$MINIO_PASSWORD" | docker secret create minio-secret-key - 2>/dev/null || echo "Secret minio-secret-key already exists"

echo "✅ Secrets created"

# Create Core API configuration
echo "⚙️ Creating Core API configuration..."
cat > /tmp/core-config.json << EOF
{
  "transport": {
    "url": "amqp://rabbitmq:5672",
    "matchmaking_queue": "production-matchmaking",
    "core_queue": "production-core",
    "bot_queue": "production-bot",
    "analytics_queue": "production-analytics",
    "events_queue": "production-events",
    "events_application_key": "production-core-key",
    "celery-queue": "production-celery",
    "image_generation_queue": "production-ig",
    "submission_queue": "production-submissions",
    "notification_queue": "production-notifications"
  },
  "gql": {
    "playground": false
  },
  "logger": {
    "levels": ["error", "warn", "log"]
  },
  "minio": {
    "endPoint": "minio.$DOMAIN",
    "port": 443,
    "useSSL": true,
    "bucketNames": {
      "replays": "sprocket-replays",
      "image_generation": "sprocket-images"
    }
  },
  "redis": {
    "port": 6379,
    "host": "redis",
    "prefix": "production",
    "secure": false
  },
  "db": {
    "host": "postgres",
    "port": 5432,
    "username": "sprocketbot",
    "database": "sprocketbot",
    "enable_logs": false
  },
  "web": {
    "url": "https://$DOMAIN",
    "api_root": "https://api.$DOMAIN"
  },
  "auth": {
    "discord": {
      "callbackUrl": "https://api.$DOMAIN/login"
    },
    "google": {
      "callbackUrl": "https://api.$DOMAIN/authentication/google/login"
    },
    "epic": {
      "callbackUrl": "https://api.$DOMAIN/authentication/epic/login"
    },
    "steam": {
      "callbackUrl": "https://api.$DOMAIN/authentication/steam/login",
      "realm": "https://api.$DOMAIN"
    },
    "jwt_expiry": 12000,
    "access_expiry": "6h",
    "refresh_expiry": "7d",
    "frontend_callback": "https://$DOMAIN/auth/callback"
  },
  "defaultOrganizationId": 2
}
EOF

# Create Web configuration
echo "⚙️ Creating Web frontend configuration..."
cat > /tmp/web-config.json << EOF
{
  "api_endpoint": "https://api.$DOMAIN",
  "chatwoot": {
    "websiteToken": "$CHATWOOT_WEBSITE_TOKEN"
  }
}
EOF

# Create Discord Bot configuration
echo "⚙️ Creating Discord Bot configuration..."
cat > /tmp/discord-bot-config.json << EOF
{
  "bot": {
    "prefix": "s."
  },
  "transport": {
    "url": "amqp://rabbitmq:5672",
    "matchmaking_queue": "production-matchmaking",
    "core_queue": "production-core",
    "bot_queue": "production-bot",
    "analytics_queue": "production-analytics",
    "events_queue": "production-events",
    "events_application_key": "production-bot-key",
    "celery-queue": "production-celery",
    "image_generation_queue": "production-ig",
    "submission_queue": "production-submissions",
    "notification_queue": "production-notifications"
  },
  "minio": {
    "endPoint": "minio.$DOMAIN",
    "port": 443,
    "useSSL": true,
    "bucketNames": {
      "replays": "sprocket-replays",
      "image_generation": "sprocket-images"
    }
  },
  "logger": {
    "levels": ["error", "warn", "log"]
  },
  "gql": {
    "url": "http://core:3001/graphql"
  }
}
EOF

# Create Docker configs
docker config create core-config /tmp/core-config.json 2>/dev/null || (docker config rm core-config && docker config create core-config /tmp/core-config.json)
docker config create web-config /tmp/web-config.json 2>/dev/null || (docker config rm web-config && docker config create web-config /tmp/web-config.json)
docker config create discord-bot-config /tmp/discord-bot-config.json 2>/dev/null || (docker config rm discord-bot-config && docker config create discord-bot-config /tmp/discord-bot-config.json)

# Clean up temp files
rm /tmp/core-config.json /tmp/web-config.json /tmp/discord-bot-config.json

echo "✅ Configurations created"

# Deploy Core API
echo "🔥 Deploying Core API..."
cat > /srv/core.yml << EOF
version: '3.8'
services:
  core:
    image: ghcr.io/sprocketbot/core:main
    environment:
      NODE_ENV: production
      CONFIG_FILE: /app/config/production.json
    networks:
      - sprocket-platform
      - postgres-network
      - traefik-ingress
    secrets:
      - jwt-secret
      - postgres-password
      - minio-access-key
      - minio-secret-key
      - discord-client-id
      - discord-client-secret
      - google-client-id
      - google-client-secret
      - redis-password
    configs:
      - source: core-config
        target: /app/config/production.json
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role != manager
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.core.rule=Host(\`api.$DOMAIN\`)"
        - "traefik.http.routers.core.entrypoints=websecure"
        - "traefik.http.routers.core.tls.certresolver=lets-encrypt-tls"
        - "traefik.http.services.core.loadbalancer.server.port=3001"

configs:
  core-config:
    external: true

secrets:
  jwt-secret:
    external: true
  postgres-password:
    external: true
  minio-access-key:
    external: true
  minio-secret-key:
    external: true
  discord-client-id:
    external: true
  discord-client-secret:
    external: true
  google-client-id:
    external: true
  google-client-secret:
    external: true
  redis-password:
    external: true

networks:
  sprocket-platform:
    external: true
  postgres-network:
    external: true
  traefik-ingress:
    external: true
EOF

docker stack deploy -c /srv/core.yml core
echo "✅ Core API deployed"

# Deploy Web Frontend
echo "🌐 Deploying Web Frontend..."
cat > /srv/web.yml << EOF
version: '3.8'
services:
  web:
    image: ghcr.io/sprocketbot/web:main
    environment:
      NODE_ENV: production
    networks:
      - traefik-ingress
    configs:
      - source: web-config
        target: /app/config/production.json
    deploy:
      replicas: 2
      placement:
        constraints:
          - node.role != manager
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.web.rule=Host(\`$DOMAIN\`)"
        - "traefik.http.routers.web.entrypoints=websecure"
        - "traefik.http.routers.web.tls.certresolver=lets-encrypt-tls"
        - "traefik.http.services.web.loadbalancer.server.port=3000"

configs:
  web-config:
    external: true

networks:
  traefik-ingress:
    external: true
EOF

docker stack deploy -c /srv/web.yml web
echo "✅ Web Frontend deployed"

# Deploy Discord Bot
echo "🤖 Deploying Discord Bot..."
cat > /srv/discord-bot.yml << 'EOF'
version: '3.8'
services:
  discord-bot:
    image: ghcr.io/sprocketbot/discord-bot:main
    environment:
      NODE_ENV: production
    networks:
      - sprocket-platform
    secrets:
      - discord-bot-token
      - minio-access-key
      - minio-secret-key
    configs:
      - source: discord-bot-config
        target: /app/config/production.json
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role != manager
      labels:
        - "traefik.enable=false"

configs:
  discord-bot-config:
    external: true

secrets:
  discord-bot-token:
    external: true
  minio-access-key:
    external: true
  minio-secret-key:
    external: true

networks:
  sprocket-platform:
    external: true
EOF

docker stack deploy -c /srv/discord-bot.yml discord-bot
echo "✅ Discord Bot deployed"

# Wait for services
echo ""
echo "⏳ Waiting for services to start..."
sleep 30

# Run database migrations
echo "🗄️ Running database migrations..."
echo "Waiting for Core API to be ready..."

# Wait for core service to be healthy
for i in {1..30}; do
    if docker service logs core_core 2>/dev/null | grep -q "Server is running"; then
        echo "Core API is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️ Core API may not be fully ready, but continuing with migration"
    fi
    sleep 10
done

# Run migrations
docker run --rm \
  --network postgres-network \
  --env-file <(echo "POSTGRES_HOST=postgres"; echo "POSTGRES_USER=sprocketbot"; echo "POSTGRES_PASSWORD=$PostgreSQL_Password"; echo "POSTGRES_DATABASE=sprocketbot") \
  ghcr.io/sprocketbot/core:main \
  npm run migration:run || echo "⚠️ Migration failed or already up to date"

# Create Minio buckets
echo "📦 Creating Minio buckets..."
docker run --rm \
  --network sprocket-platform \
  --env MINIO_ENDPOINT=minio:9000 \
  --env MINIO_ACCESS_KEY=sprocketbot \
  --env MINIO_SECRET_KEY="$MINIO_PASSWORD" \
  minio/mc:latest sh -c "
    mc alias set minio http://minio:9000 sprocketbot $MINIO_PASSWORD
    mc mb minio/sprocket-replays --ignore-existing
    mc mb minio/sprocket-images --ignore-existing
  " || echo "⚠️ Bucket creation failed or buckets already exist"

# Final verification
echo ""
echo "🔍 Verifying deployment..."
echo "=========================="

echo "Service status:"
docker service ls

echo ""
echo "✅ Application deployment complete!"
echo ""
echo "📋 Your SprocketBot deployment is ready:"
echo "========================================"
echo "• Main Website: https://$DOMAIN"
echo "• API Endpoint: https://api.$DOMAIN"
echo "• Traefik Dashboard: https://traefik.$DOMAIN"
echo "• RabbitMQ Management: https://rabbitmq.$DOMAIN"
echo "• Minio Console: https://minio-console.$DOMAIN"
echo ""
echo "🔧 Admin Access:"
echo "RabbitMQ - User: sprocketbot, Password: $RABBITMQ_PASSWORD"
echo "Minio - User: sprocketbot, Password: $MINIO_PASSWORD"
echo ""
echo "🔒 Configuration files:"
echo "• Infrastructure passwords: /srv/infrastructure-passwords.txt"
echo "• Application secrets: /srv/deployment-config.txt"
echo ""
echo "🚀 Your SprocketBot platform is now live!"
echo ""
echo "Next steps:"
echo "1. Verify services are accessible via web browser"
echo "2. Test Discord bot functionality"
echo "3. Check application logs: docker service logs core_core"
echo "4. Monitor resource usage: docker stats"
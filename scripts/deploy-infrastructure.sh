#!/bin/bash
set -e

# SprocketBot Docker Services Deployment Script
# This script deploys the core Docker services (Traefik, Redis, RabbitMQ, Minio)
# Run this script on your Docker Swarm manager node AFTER deploying DigitalOcean infrastructure

echo "🚀 SprocketBot Infrastructure Deployment"
echo "========================================"
echo ""

# Check if we're on a swarm manager
if ! docker info | grep -q "Swarm: active"; then
    echo "❌ Error: Docker Swarm is not active on this node"
    echo "Please run 'docker swarm init' first"
    exit 1
fi

if ! docker info | grep -q "Is Manager: true"; then
    echo "❌ Error: This script must be run on a Docker Swarm manager node"
    exit 1
fi

# Get domain configuration
echo "📝 Configuration Setup"
echo "====================="
echo ""
read -p "Enter your domain (e.g., sprocketbot.gg): " DOMAIN
read -p "Enter your email for SSL certificates: " EMAIL

# Validate domain
if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$ ]]; then
    echo "❌ Invalid domain format. Please use format like: example.com"
    exit 1
fi

echo ""
echo "Using domain: $DOMAIN"
echo "SSL certificates will be issued to: $EMAIL"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 1
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p /srv/traefik
mkdir -p /srv/configs

# Create Docker networks
echo "🌐 Creating Docker networks..."
docker network create --driver overlay traefik-ingress || true
docker network create --driver overlay traefik-proxy || true
docker network create --driver overlay sprocket-platform || true
docker network create --driver overlay monitoring-network || true

echo "✅ Networks created"

# Deploy Traefik Configuration
echo "⚙️ Configuring Traefik..."
cat > /srv/traefik/traefik.yml << EOF
entryPoints:
  web:
    address: ':80'
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ':443'

api:
  dashboard: true
  insecure: true

certificatesResolvers:
  lets-encrypt-tls:
    acme:
      email: $EMAIL
      storage: /data/le-tls.json
      tlsChallenge: {}

providers:
  docker:
    watch: true
    exposedByDefault: false
    swarmMode: true
    network: traefik-ingress
    endpoint: "tcp://socket-proxy:2375"

log:
  level: info
EOF

# Deploy Socket Proxy
echo "🔒 Deploying Docker Socket Proxy..."
cat > /srv/traefik-socket-proxy.yml << 'EOF'
version: '3.8'
services:
  socket-proxy:
    image: tecnativa/docker-socket-proxy
    networks:
      - traefik-proxy
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      CONTAINERS: 1
      SERVICES: 1
      SWARM: 1
      TASKS: 1
      NETWORKS: 1
    deploy:
      placement:
        constraints:
          - node.role == manager

networks:
  traefik-proxy:
    external: true
EOF

docker stack deploy -c /srv/traefik-socket-proxy.yml socket-proxy

# Wait for socket proxy
echo "⏳ Waiting for socket proxy to be ready..."
sleep 10

# Deploy Traefik
echo "🚦 Deploying Traefik..."
cat > /srv/traefik.yml << EOF
version: '3.8'
services:
  traefik:
    image: traefik:v3.0
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /srv/traefik/traefik.yml:/etc/traefik/traefik.yml:ro
      - traefik-ssl:/data
    networks:
      - traefik-ingress
      - traefik-proxy
    deploy:
      placement:
        constraints:
          - node.role == manager
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.api.rule=Host(\`traefik.$DOMAIN\`)"
        - "traefik.http.routers.api.entrypoints=websecure"
        - "traefik.http.routers.api.tls.certresolver=lets-encrypt-tls"
        - "traefik.http.services.api.loadbalancer.server.port=8080"

volumes:
  traefik-ssl:

networks:
  traefik-ingress:
    external: true
  traefik-proxy:
    external: true
EOF

docker stack deploy -c /srv/traefik.yml traefik

echo "✅ Traefik deployed"
echo "📊 Traefik dashboard will be available at: https://traefik.$DOMAIN"

# Generate secure passwords (managed Postgres password is provided, not generated here)
echo "🔐 Generating secure passwords..."
REDIS_PASSWORD=$(openssl rand -base64 32)
RABBITMQ_PASSWORD=$(openssl rand -base64 32)
MINIO_PASSWORD=$(openssl rand -base64 32)

# Create secrets
echo "🔑 Creating database and service secrets..."
echo "$REDIS_PASSWORD" | docker secret create redis-password - 2>/dev/null || echo "Secret redis-password already exists"
echo "$RABBITMQ_PASSWORD" | docker secret create rabbitmq-password - 2>/dev/null || echo "Secret rabbitmq-password already exists"
echo "$MINIO_PASSWORD" | docker secret create minio-password - 2>/dev/null || echo "Secret minio-password already exists"

# Save passwords for later reference
cat > /srv/infrastructure-passwords.txt << EOF
# SprocketBot Infrastructure Passwords
# Generated on $(date)
# KEEP THIS FILE SECURE!

Redis Password: $REDIS_PASSWORD
RabbitMQ Password: $RABBITMQ_PASSWORD
Minio Password: $MINIO_PASSWORD

# Connection strings for application configuration (Postgres managed, see /srv/managed-db.env):
Redis: redis://:$REDIS_PASSWORD@redis:6379
RabbitMQ: amqp://sprocketbot:$RABBITMQ_PASSWORD@rabbitmq:5672
Minio Access Key: sprocketbot
Minio Secret Key: $MINIO_PASSWORD
EOF

chmod 600 /srv/infrastructure-passwords.txt

echo "✅ Passwords saved to /srv/infrastructure-passwords.txt"

# Configure Managed Postgres (from Pulumi outputs)
echo "🐘 Configuring Managed PostgreSQL..."

# Try to load from deployment-info.txt if present
DB_HOST=""; DB_PORT=""; DB_NAME=""; DB_USER=""; DB_PASSWORD=""
if [[ -f /root/deployment-info.txt ]]; then
  echo "Found /root/deployment-info.txt, loading DB details..."
  source <(grep -E '^(DB_HOST|DB_PORT|DB_NAME|DB_USER)=' /root/deployment-info.txt | sed 's/\r$//')
fi

echo "" 
if [[ -z "$DB_HOST" ]]; then read -p "Enter Managed Postgres Host: " DB_HOST; fi
if [[ -z "$DB_PORT" ]]; then read -p "Enter Managed Postgres Port [5432]: " DB_PORT; DB_PORT=${DB_PORT:-5432}; fi
if [[ -z "$DB_NAME" ]]; then read -p "Enter Managed Postgres Database [sprocketbot]: " DB_NAME; DB_NAME=${DB_NAME:-sprocketbot}; fi
if [[ -z "$DB_USER" ]]; then read -p "Enter Managed Postgres User [sprocketbot]: " DB_USER; DB_USER=${DB_USER:-sprocketbot}; fi
read -s -p "Enter Managed Postgres Password: " DB_PASSWORD; echo ""

# Create/update secret for DB password using the traditional name used by apps
if [[ -n "$DB_PASSWORD" ]]; then
  echo "$DB_PASSWORD" | docker secret create postgres-password - 2>/dev/null || (docker secret rm postgres-password >/dev/null 2>&1 && echo "$DB_PASSWORD" | docker secret create postgres-password -)
  echo "✅ Stored DB password in docker secret: postgres-password"
else
  echo "❌ No DB password provided; services may fail to connect to Postgres"
fi

# Save managed DB settings (without password)
cat > /srv/managed-db.env << EOF
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
EOF
chmod 600 /srv/managed-db.env
echo "✅ Saved managed DB settings to /srv/managed-db.env"

# Deploy Redis
echo "🔴 Deploying Redis..."
cat > /srv/redis.yml << 'EOF'
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass "${REDIS_PASSWORD}"
    environment:
      REDIS_PASSWORD_FILE: /run/secrets/redis-password
    networks:
      - sprocket-platform
    secrets:
      - redis-password
    deploy:
      labels:
        - "traefik.enable=false"

secrets:
  redis-password:
    external: true

networks:
  sprocket-platform:
    external: true
EOF

docker stack deploy -c /srv/redis.yml redis
echo "✅ Redis deployed"

# Deploy RabbitMQ
echo "🐰 Deploying RabbitMQ..."
cat > /srv/rabbitmq.yml << EOF
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: sprocketbot
      RABBITMQ_DEFAULT_PASS_FILE: /run/secrets/rabbitmq-password
    networks:
      - sprocket-platform
      - traefik-ingress
    secrets:
      - rabbitmq-password
    deploy:
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.rabbitmq.rule=Host(\`rabbitmq.$DOMAIN\`)"
        - "traefik.http.routers.rabbitmq.entrypoints=websecure"
        - "traefik.http.routers.rabbitmq.tls.certresolver=lets-encrypt-tls"
        - "traefik.http.services.rabbitmq.loadbalancer.server.port=15672"

secrets:
  rabbitmq-password:
    external: true

networks:
  sprocket-platform:
    external: true
  traefik-ingress:
    external: true
EOF

docker stack deploy -c /srv/rabbitmq.yml rabbitmq
echo "✅ RabbitMQ deployed"
echo "📊 RabbitMQ management will be available at: https://rabbitmq.$DOMAIN"
echo "   Username: sprocketbot"
echo "   Password: $RABBITMQ_PASSWORD"

# Deploy Minio
echo "📦 Deploying Minio..."
cat > /srv/minio.yml << EOF
version: '3.8'
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: sprocketbot
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/minio-password
    volumes:
      - /mnt/minio-data:/data
    networks:
      - sprocket-platform
      - traefik-ingress
    secrets:
      - minio-password
    deploy:
      placement:
        constraints:
          - node.role == manager
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.minio-api.rule=Host(\`minio.$DOMAIN\`)"
        - "traefik.http.routers.minio-api.entrypoints=websecure"
        - "traefik.http.routers.minio-api.tls.certresolver=lets-encrypt-tls"
        - "traefik.http.routers.minio-api.service=minio-api"
        - "traefik.http.services.minio-api.loadbalancer.server.port=9000"
        - "traefik.http.routers.minio-console.rule=Host(\`minio-console.$DOMAIN\`)"
        - "traefik.http.routers.minio-console.entrypoints=websecure"
        - "traefik.http.routers.minio-console.tls.certresolver=lets-encrypt-tls"
        - "traefik.http.routers.minio-console.service=minio-console"
        - "traefik.http.services.minio-console.loadbalancer.server.port=9001"

secrets:
  minio-password:
    external: true

networks:
  sprocket-platform:
    external: true
  traefik-ingress:
    external: true
EOF

docker stack deploy -c /srv/minio.yml minio
echo "✅ Minio deployed"
echo "📊 Minio console will be available at: https://minio-console.$DOMAIN"
echo "📡 Minio API available at: https://minio.$DOMAIN"
echo "   Username: sprocketbot"
echo "   Password: $MINIO_PASSWORD"

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to be ready..."
sleep 30

# Verify deployment
echo ""
echo "🔍 Verifying deployment..."
echo "=========================="

# Check services
echo "Service status:"
docker service ls

echo ""
echo "✅ Infrastructure deployment complete!"
echo ""
echo "📋 Summary:"
echo "==========="
echo "• Traefik Dashboard: https://traefik.$DOMAIN"
echo "• RabbitMQ Management: https://rabbitmq.$DOMAIN"
echo "• Minio Console: https://minio-console.$DOMAIN"
echo "• Minio API: https://minio.$DOMAIN"
echo ""
echo "🔒 Passwords saved in: /srv/infrastructure-passwords.txt"
echo "🐘 Managed Postgres settings saved in: /srv/managed-db.env (password in docker secret 'postgres-password')"
echo ""
echo "🚀 Ready for application deployment!"
echo "Run ./deploy-applications.sh to deploy SprocketBot services"

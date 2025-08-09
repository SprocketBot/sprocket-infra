# SprocketBot Application Deployment Guide

This guide covers deploying the actual SprocketBot applications to your DigitalOcean infrastructure. This assumes you have already completed the [infrastructure deployment](DEPLOYMENT_GUIDE.md).

## 📋 Prerequisites

### Infrastructure Requirements
- ✅ **DigitalOcean infrastructure deployed** (from DEPLOYMENT_GUIDE.md)
- ✅ **Docker Swarm cluster running** (manager + workers joined)
- ✅ **DNS configured** (domain pointing to load balancer)
- ✅ **SSH access** to manager node

### Required Information
You'll need these values from your infrastructure deployment:
```bash
cd digitalocean-platform
export MANAGER_IP=$(pulumi stack output managerIp)
export LOAD_BALANCER_IP=$(pulumi stack output loadBalancerIp)
```

## 🏗️ SprocketBot Architecture Overview

### Service Categories

**Core Services:**
- **core**: Main GraphQL API backend (NestJS)
- **web**: Frontend application (SvelteKit)
- **discord-bot**: Discord integration (NestJS)

**Infrastructure Services:**
- **traefik**: Reverse proxy & SSL termination
- **postgres**: Primary database
- **redis**: Caching & sessions
- **rabbitmq**: Message queue
- **minio**: Object storage

**Microservices:**
- **image-generation-service**: Image processing (NestJS)
- **image-generation-frontend**: Image generation UI (SvelteKit)
- **matchmaking-service**: Game matchmaking (NestJS)
- **server-analytics-service**: Analytics collection (NestJS)
- **notification-service**: Push notifications (NestJS)
- **elo-service**: ELO rating calculations (NestJS)
- **submission-service**: File submissions (NestJS)
- **replay-parse-service**: Replay file processing (Python)

## 🚀 Deployment Process

### Step 1: Connect to Manager Node

```bash
ssh root@$MANAGER_IP
```

### Step 2: Create Docker Networks

SprocketBot uses overlay networks for service isolation:

```bash
# Main application network
docker network create --driver overlay sprocket-platform

# Infrastructure networks
docker network create --driver overlay postgres-network
docker network create --driver overlay monitoring-network
docker network create --driver overlay traefik-ingress
```

### Step 3: Deploy Infrastructure Services

#### Deploy Traefik (Reverse Proxy)

Create Traefik configuration:
```bash
mkdir -p /srv/traefik
cat > /srv/traefik/traefik.yml << 'EOF'
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
      email: your-email@domain.com
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
```

Create Docker socket proxy for security:
```bash
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
    driver: overlay
    name: traefik-proxy
EOF

docker stack deploy -c /srv/traefik-socket-proxy.yml socket-proxy
```

Deploy Traefik:
```bash
cat > /srv/traefik.yml << 'EOF'
version: '3.8'
services:
  traefik:
    image: traefik:v3.0
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Dashboard
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
        - "traefik.http.routers.api.rule=Host(`traefik.yourdomain.com`)"
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
```

#### Deploy PostgreSQL

```bash
cat > /srv/postgres.yml << 'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: sprocketbot
      POSTGRES_USER: sprocketbot
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres-password
    volumes:
      - /mnt/postgres-data:/var/lib/postgresql/data
    networks:
      - postgres-network
    secrets:
      - postgres-password
    deploy:
      placement:
        constraints:
          - node.role == manager
      labels:
        - "traefik.enable=false"

secrets:
  postgres-password:
    external: true

networks:
  postgres-network:
    external: true
EOF

# Create PostgreSQL password secret
echo "your_secure_postgres_password" | docker secret create postgres-password -
docker stack deploy -c /srv/postgres.yml postgres
```

#### Deploy Redis

```bash
cat > /srv/redis.yml << 'EOF'
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass "$REDIS_PASSWORD"
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

echo "your_secure_redis_password" | docker secret create redis-password -
docker stack deploy -c /srv/redis.yml redis
```

#### Deploy RabbitMQ

```bash
cat > /srv/rabbitmq.yml << 'EOF'
version: '3.8'
services:
  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: sprocketbot
      RABBITMQ_DEFAULT_PASS_FILE: /run/secrets/rabbitmq-password
    networks:
      - sprocket-platform
    secrets:
      - rabbitmq-password
    deploy:
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.rabbitmq.rule=Host(`rabbitmq.yourdomain.com`)"
        - "traefik.http.routers.rabbitmq.entrypoints=websecure"
        - "traefik.http.routers.rabbitmq.tls.certresolver=lets-encrypt-tls"
        - "traefik.http.services.rabbitmq.loadbalancer.server.port=15672"

secrets:
  rabbitmq-password:
    external: true

networks:
  sprocket-platform:
    external: true
EOF

echo "your_secure_rabbitmq_password" | docker secret create rabbitmq-password -
docker stack deploy -c /srv/rabbitmq.yml rabbitmq
```

#### Deploy Minio (Object Storage)

```bash
cat > /srv/minio.yml << 'EOF'
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
        # API endpoint
        - "traefik.enable=true"
        - "traefik.http.routers.minio-api.rule=Host(`minio.yourdomain.com`)"
        - "traefik.http.routers.minio-api.entrypoints=websecure"
        - "traefik.http.routers.minio-api.tls.certresolver=lets-encrypt-tls"
        - "traefik.http.routers.minio-api.service=minio-api"
        - "traefik.http.services.minio-api.loadbalancer.server.port=9000"
        # Console
        - "traefik.http.routers.minio-console.rule=Host(`minio-console.yourdomain.com`)"
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

echo "your_secure_minio_password" | docker secret create minio-password -
docker stack deploy -c /srv/minio.yml minio
```

### Step 4: Create Application Secrets

Create all required application secrets:

```bash
# Application secrets
echo "your_jwt_secret_key" | docker secret create jwt-secret -
echo "your_discord_client_id" | docker secret create discord-client-id -
echo "your_discord_client_secret" | docker secret create discord-client-secret -
echo "your_discord_bot_token" | docker secret create discord-bot-token -
echo "your_google_client_id" | docker secret create google-client-id -
echo "your_google_client_secret" | docker secret create google-client-secret -
echo "your_epic_client_id" | docker secret create epic-client-id -
echo "your_epic_client_secret" | docker secret create epic-client-secret -
echo "your_steam_api_key" | docker secret create steam-api-key -
echo "your_ballchasing_api_token" | docker secret create ballchasing-api-token -
echo "your_chatwoot_hmac_key" | docker secret create chatwoot-hmac-key -

# Minio access credentials
echo "sprocketbot" | docker secret create minio-access-key -
echo "your_secure_minio_password" | docker secret create minio-secret-key -
```

### Step 5: Deploy Core Application Services

#### Deploy Core API Service

```bash
cat > /srv/core.yml << 'EOF'
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
      - epic-client-id
      - epic-client-secret
      - steam-api-key
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
        - "traefik.http.routers.core.rule=Host(`api.yourdomain.com`)"
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
  epic-client-id:
    external: true
  epic-client-secret:
    external: true
  steam-api-key:
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
```

First, create the core configuration:
```bash
cat > /tmp/core-config.json << 'EOF'
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
    "endPoint": "minio.yourdomain.com",
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
    "url": "https://yourdomain.com",
    "api_root": "https://api.yourdomain.com"
  },
  "auth": {
    "discord": {
      "callbackUrl": "https://api.yourdomain.com/login"
    },
    "google": {
      "callbackUrl": "https://api.yourdomain.com/authentication/google/login"
    },
    "epic": {
      "callbackUrl": "https://api.yourdomain.com/authentication/epic/login"
    },
    "steam": {
      "callbackUrl": "https://api.yourdomain.com/authentication/steam/login",
      "realm": "https://api.yourdomain.com"
    },
    "jwt_expiry": 12000,
    "access_expiry": "6h",
    "refresh_expiry": "7d",
    "frontend_callback": "https://yourdomain.com/auth/callback"
  },
  "defaultOrganizationId": 2
}
EOF

docker config create core-config /tmp/core-config.json
docker stack deploy -c /srv/core.yml core
```

#### Deploy Web Frontend

```bash
cat > /srv/web.yml << 'EOF'
version: '3.8'
services:
  web:
    image: ghcr.io/sprocketbot/web:main
    environment:
      NODE_ENV: production
    networks:
      - traefik-ingress
    secrets:
      - chatwoot-hmac-key
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
        - "traefik.http.routers.web.rule=Host(`yourdomain.com`)"
        - "traefik.http.routers.web.entrypoints=websecure"
        - "traefik.http.routers.web.tls.certresolver=lets-encrypt-tls"
        - "traefik.http.services.web.loadbalancer.server.port=3000"

configs:
  web-config:
    external: true

secrets:
  chatwoot-hmac-key:
    external: true

networks:
  traefik-ingress:
    external: true
EOF

# Create web configuration
cat > /tmp/web-config.json << 'EOF'
{
  "api_endpoint": "https://api.yourdomain.com",
  "chatwoot": {
    "websiteToken": "your_chatwoot_website_token"
  }
}
EOF

docker config create web-config /tmp/web-config.json
docker stack deploy -c /srv/web.yml web
```

#### Deploy Discord Bot

```bash
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

# Create Discord bot configuration
cat > /tmp/discord-bot-config.json << 'EOF'
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
    "endPoint": "minio.yourdomain.com",
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

docker config create discord-bot-config /tmp/discord-bot-config.json
docker stack deploy -c /srv/discord-bot.yml discord-bot
```

### Step 6: Initialize Database

```bash
# Wait for core service to be healthy
docker service logs core_core

# Run database migrations
docker service create --rm \
  --name db-migrate \
  --network postgres-network \
  --secret postgres-password \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_USER=sprocketbot \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password \
  -e POSTGRES_DATABASE=sprocketbot \
  ghcr.io/sprocketbot/core:main \
  npm run migration:run
```

### Step 7: Deploy Additional Services (Optional)

You can deploy additional microservices following the same pattern:

#### Microservice Template

```bash
cat > /srv/microservice-template.yml << 'EOF'
version: '3.8'
services:
  SERVICE_NAME:
    image: ghcr.io/sprocketbot/SERVICE_NAME:main
    environment:
      NODE_ENV: production
    networks:
      - sprocket-platform
    secrets:
      - redis-password
      # Add other secrets as needed
    configs:
      - source: SERVICE_NAME-config
        target: /app/config/production.json
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role != manager
      labels:
        - "traefik.enable=false"  # Most microservices are internal

configs:
  SERVICE_NAME-config:
    external: true

secrets:
  redis-password:
    external: true

networks:
  sprocket-platform:
    external: true
EOF
```

## ✅ Verification & Testing

### Service Health Checks

```bash
# Check all services are running
docker service ls

# Check individual service logs
docker service logs core_core
docker service logs web_web
docker service logs discord-bot_discord-bot

# Check network connectivity
docker run --rm --network sprocket-platform alpine/curl curl -f http://core:3001/health
```

### Application Testing

1. **Frontend Access**: Visit `https://yourdomain.com`
2. **API Health**: Visit `https://api.yourdomain.com/health`
3. **Traefik Dashboard**: Visit `https://traefik.yourdomain.com`
4. **Minio Console**: Visit `https://minio-console.yourdomain.com`

### SSL Certificate Verification

```bash
# Check certificates are issued
curl -I https://yourdomain.com
curl -I https://api.yourdomain.com

# Check Traefik logs for ACME
docker service logs traefik_traefik
```

## 🔧 Configuration Management

### Updating Service Configuration

1. **Update config file**:
   ```bash
   # Remove old config
   docker config rm core-config
   
   # Create new config
   docker config create core-config /path/to/new/config.json
   ```

2. **Update service**:
   ```bash
   docker service update --config-rm core-config --config-add source=core-config,target=/app/config/production.json core_core
   ```

### Managing Secrets

```bash
# Update a secret
echo "new_secret_value" | docker secret create new-secret-name -
docker service update --secret-rm old-secret-name --secret-add new-secret-name service_name
```

### Scaling Services

```bash
# Scale core service
docker service scale core_core=3

# Scale web frontend
docker service scale web_web=4
```

## 🚨 Troubleshooting

### Common Issues

**Service won't start**:
```bash
# Check service logs
docker service logs SERVICE_NAME

# Check service details
docker service ps SERVICE_NAME --no-trunc

# Check network connectivity
docker run --rm --network NETWORK_NAME alpine ping SERVICE_NAME
```

**SSL Certificate Issues**:
```bash
# Check Traefik logs
docker service logs traefik_traefik | grep -i acme

# Verify domain DNS
nslookup yourdomain.com

# Check certificate resolver configuration
docker exec $(docker ps -q -f name=traefik) cat /data/le-tls.json
```

**Database Connection Issues**:
```bash
# Test database connectivity
docker run --rm --network postgres-network postgres:14 psql -h postgres -U sprocketbot -d sprocketbot -c "SELECT version();"
```

**Service Discovery Issues**:
```bash
# Check Docker networks
docker network ls | grep overlay

# Check service placement
docker service ps SERVICE_NAME

# Check service endpoints
docker service inspect SERVICE_NAME --format='{{.Endpoint}}'
```

### Performance Monitoring

```bash
# Monitor resource usage
docker stats

# Check service resource constraints
docker service inspect SERVICE_NAME --format='{{.Spec.TaskTemplate.Resources}}'

# Monitor load balancer status
curl -s http://traefik.yourdomain.com/api/http/services
```

## 🔄 Updates & Maintenance

### Updating Application Images

```bash
# Update to latest version
docker service update --image ghcr.io/sprocketbot/core:latest core_core

# Update with specific tag
docker service update --image ghcr.io/sprocketbot/web:v2.1.0 web_web
```

### Rolling Updates

Docker Swarm performs rolling updates automatically:
- Services are updated one replica at a time
- Health checks ensure new containers are healthy before proceeding
- Rollback is available if issues occur

### Backup Procedures

```bash
# Backup PostgreSQL database
docker exec $(docker ps -q -f name=postgres) pg_dump -U sprocketbot sprocketbot > backup.sql

# Backup Minio data (already persisted to volume)
# Backup Docker configs and secrets (store securely)
```

---

**🎉 Congratulations!** Your SprocketBot application is now deployed and running on DigitalOcean with automatic SSL, load balancing, and high availability.
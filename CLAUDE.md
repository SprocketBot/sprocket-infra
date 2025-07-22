# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the infrastructure-as-code repository for SprocketBot, a gaming platform focused on Rocket League. It uses Pulumi with TypeScript to manage multi-layer cloud infrastructure deployment.

## Common Development Commands

### Prerequisites
- Ensure AWS credentials are configured in `~/.aws/credentials`
- Sign in to Pulumi: `pulumi login "s3://[your bucket]/pulumi?endpoint=[your endpoint]"`

### Deployment Order
Infrastructure must be deployed in this specific order:
1. **Layer 1** (`./layer_1/`): Core networking (Ingress, Vault networks)
2. **Layer 2** (`./layer_2/`): Infrastructure services (PostgreSQL, monitoring, Vault policies)
3. **Platform** (`./platform/`): Application services and microservices

### Working with Each Layer
Each layer is a separate Pulumi project with its own package.json:

```bash
# Navigate to specific layer
cd layer_1  # or layer_2, platform

# Install dependencies
npm install

# Deploy infrastructure
pulumi up

# Check stack status
pulumi stack ls
pulumi stack output
```

### Vault Token Configuration
Layer 2 requires vault token configuration:
```bash
cd layer_2
pulumi config set vault-token --secret [root token]
```

### Docker Host Configuration (if needed)
For remote Docker deployments:
```bash
ssh -L localhost:2377:/var/run/docker.sock user@remotehost
export DOCKER_HOST=tcp://localhost:2377
```

## Architecture Overview

### Infrastructure Layers
- **Global** (`./global/`): Shared components, providers, and service definitions used across all layers
- **Layer 1**: Base networking infrastructure (Traefik ingress, Vault)
- **Layer 2**: Shared infrastructure services (PostgreSQL, Redis, RabbitMQ, monitoring stack)
- **Platform**: Application-specific deployments per environment (dev/staging/main)

### Key Components
- **Platform.ts**: Main platform orchestrator managing all microservices and clients
- **Secrets Management**: Recently migrated from self-hosted Vault to Doppler
- **Service Architecture**: Microservices pattern with shared configuration and networking
- **Monitoring**: Full observability stack (InfluxDB, Grafana, Loki, FluentD, Telegraf)

### Service Categories
- **Core Services**: Main API (`core`), Discord bot, web frontend
- **Microservices**: Image generation, matchmaking, analytics, notifications, submissions, ELO calculation
- **Infrastructure**: PostgreSQL, Redis, RabbitMQ, Minio object storage

### Environment Structure
Each environment (dev/staging/main) gets its own:
- Docker network isolation
- Subdomain-based routing (`api.dev.sprocketbot.gg`, `api.sprocketbot.gg`)
- Environment-specific configuration and secrets
- Separate database schemas and object storage buckets

### Configuration Management
- Services use JSON configuration files in `./platform/src/config/services/`
- Shared configuration built dynamically in `Platform.buildDefaultConfiguration()`
- Secrets managed through Doppler integration via `PlatformDoppler`
- Environment variables and service discovery handled automatically

### Dependencies and Stack References
- Global package provides shared utilities and type definitions
- Layer dependencies: Layer 2 depends on Layer 1 exports, Platform depends on both
- Stack references used for cross-layer resource sharing (network IDs, database URLs, etc.)

## Important Files
- `platform/src/Platform.ts`: Main platform definition and service orchestration
- `global/services/`: Individual service definitions (Postgres, Redis, etc.)
- `global/refs/`: Stack reference definitions and exports
- `services-summary.md`: Detailed breakdown of all application services
- `go-live-plan.md`: Production deployment checklist
- `needed-secrets.md`: Required secrets documentation

## Development Notes
- No test commands are defined in package.json files - this is infrastructure code
- TypeScript configuration uses standard Pulumi project structure
- All layers use ES modules (`"type": "module"` in package.json)
- The platform supports staging exclusions (legacy services don't deploy to staging)
- Alpha testing restrictions can be enabled via `alpha-restrictions` config flag
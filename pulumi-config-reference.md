# Pulumi Configuration Reference

This file contains all configuration values (secrets and non-secrets) that need to be recreated for the Pulumi stacks.

## Secrets to Recreate (10 total)

### layer_1 secrets:
- `discord-fa-client-secret` - Discord OAuth client secret for forward auth
- `docker-access-token` - Docker Hub access token
- `vault-s3-secret-key` - S3 secret key for Vault backend storage

### layer_2 secrets:
- `root-vault-token` - Vault root token
- `smtp-password` - SMTP password for email notifications

### platform secrets:
- `discord-bot-token` - Discord bot token (per environment)
- `docker-access-token` - Docker Hub access token (per environment)
- `legacy-bot-token` - Legacy bot token (dev environment)
- `legacy-bot-token-emilia` - Legacy bot token for Emilia (main environment)
- `legacy-bot-token-emilio` - Legacy bot token for Emilio (main environment)
- `legacy-bot-token` - Legacy bot token (staging environment)

## Non-Secret Configuration Values

### layer_1 (Pulumi.layer_1.yaml):
```yaml
layer_1:docker-username: actualsovietshark
layer_1:vault-s3-access-key: YWS9AKY66LS815BUPG6G
layer_1:vault-s3-bucket: sprocket
layer_1:vault-s3-endpoint: https://us-southeast-1.linodeobjects.com
```

### layer_2 (Pulumi.layer_2.yaml):
```yaml
# No non-secret config values
```

### platform (Pulumi.dev.yaml):
```yaml
platform:alpha-restrictions: "true"
platform:docker-username: actualsovietshark
platform:image-tag: dev
platform:subdomain: dev
```

### platform (Pulumi.main.yaml):
```yaml
platform:docker-username: actualsovietshark
platform:hostname: app.sprocket.gg
platform:image-tag: main
platform:split-legacy: "true"
platform:subdomain: main
```

### platform (Pulumi.staging.yaml):
```yaml
platform:docker-username: actualsovietshark
platform:hostname: app.sprocket.gg
platform:image-tag: staging
platform:subdomain: staging
```

## Additional Configuration Required

### Discord Forward Auth Client ID
Update in `/layer_1/src/config/traefik/discord-forward-auth.yaml`:
- Current: `clientId: "846086564479631372"`
- Update to your new Discord OAuth application's client ID

## Stack Recreation Commands

Once you have all secrets and values ready, use these commands to set them:

### layer_1
```bash
cd layer_1
pulumi config set layer_1:docker-username actualsovietshark
pulumi config set layer_1:vault-s3-access-key YWS9AKY66LS815BUPG6G
pulumi config set layer_1:vault-s3-bucket sprocket
pulumi config set layer_1:vault-s3-endpoint https://us-southeast-1.linodeobjects.com
pulumi config set --secret layer_1:discord-fa-client-secret YOUR_DISCORD_CLIENT_SECRET
pulumi config set --secret layer_1:docker-access-token YOUR_DOCKER_ACCESS_TOKEN
pulumi config set --secret layer_1:vault-s3-secret-key YOUR_S3_SECRET_KEY
```

### layer_2
```bash
cd layer_2
pulumi config set --secret layer_2:root-vault-token YOUR_VAULT_ROOT_TOKEN
pulumi config set --secret layer_2:smtp-password YOUR_SMTP_PASSWORD
```

### platform (dev)
```bash
cd platform
pulumi stack select dev
pulumi config set platform:alpha-restrictions "true"
pulumi config set platform:docker-username actualsovietshark
pulumi config set platform:image-tag dev
pulumi config set platform:subdomain dev
pulumi config set --secret platform:discord-bot-token YOUR_DEV_DISCORD_BOT_TOKEN
pulumi config set --secret platform:docker-access-token YOUR_DOCKER_ACCESS_TOKEN
pulumi config set --secret platform:legacy-bot-token YOUR_DEV_LEGACY_BOT_TOKEN
```

### platform (main)
```bash
cd platform
pulumi stack select main
pulumi config set platform:docker-username actualsovietshark
pulumi config set platform:hostname app.sprocket.gg
pulumi config set platform:image-tag main
pulumi config set platform:split-legacy "true"
pulumi config set platform:subdomain main
pulumi config set --secret platform:discord-bot-token YOUR_MAIN_DISCORD_BOT_TOKEN
pulumi config set --secret platform:docker-access-token YOUR_DOCKER_ACCESS_TOKEN
pulumi config set --secret platform:legacy-bot-token-emilia YOUR_EMILIA_BOT_TOKEN
pulumi config set --secret platform:legacy-bot-token-emilio YOUR_EMILIO_BOT_TOKEN
```

### platform (staging)
```bash
cd platform
pulumi stack select staging
pulumi config set platform:docker-username actualsovietshark
pulumi config set platform:hostname app.sprocket.gg
pulumi config set platform:image-tag staging
pulumi config set platform:subdomain staging
pulumi config set --secret platform:discord-bot-token YOUR_STAGING_DISCORD_BOT_TOKEN
pulumi config set --secret platform:docker-access-token YOUR_DOCKER_ACCESS_TOKEN
pulumi config set --secret platform:legacy-bot-token YOUR_STAGING_LEGACY_BOT_TOKEN
```

---

# Vault Recreation Plan

## Overview
Your Vault setup uses S3 storage backend and needs to be completely recreated. The infrastructure includes multiple backends for different purposes and OAuth secrets for various services.

## Vault Secrets/Data to Extract from Old Vault

### Manual OAuth Secrets (per environment: dev, main, staging)
**Path: `platform/{environment}/manual/oauth/`**
- `google` - { clientId, clientSecret }
- `epic` - { clientId, clientSecret }
- `steam` - { apiKey }
- `discord` - { client_id, client_secret }

### Platform-specific Secrets
**Path: `platform/ballchasing`**
- `token` - Ballchasing API token

**Path: `platform/{environment}/chatwoot`**
- `hmacKey` - Chatwoot HMAC key

### Infrastructure Secrets
**Path: `infrastructure/`** - Contains secrets for bootstrapping infrastructure auth

## Vault Recreation Steps

### Phase 1: Access Old Vault Data
1. **Get someone to unseal the old vault** - You mentioned you have access but can't unseal it
2. **Extract all secrets using vault CLI**:
   ```bash
   export VAULT_ADDR="https://vault.spr.ocket.cloud"
   export VAULT_TOKEN="<old_root_token>"

   # Extract OAuth secrets for each environment
   for env in dev main staging; do
     vault kv get -format=json platform/$env/manual/oauth/google > google-$env.json
     vault kv get -format=json platform/$env/manual/oauth/epic > epic-$env.json
     vault kv get -format=json platform/$env/manual/oauth/steam > steam-$env.json
     vault kv get -format=json platform/$env/manual/oauth/discord > discord-$env.json
     vault kv get -format=json platform/$env/chatwoot > chatwoot-$env.json
   done

   # Extract shared secrets
   vault kv get -format=json platform/ballchasing > ballchasing.json

   # Extract infrastructure secrets
   vault kv list infrastructure/ # List all paths
   # Then export each path found
   ```

### Phase 2: Setup New Vault Infrastructure
1. **Update S3 configuration** in Pulumi configs with new S3 credentials
2. **Deploy layer_1** with new Vault instance:
   ```bash
   cd layer_1
   # Set all config values from reference file
   pulumi up
   ```
3. **Initialize new Vault** - The auto-initialize script should handle this
4. **Extract root token** from new Vault initialization

### Phase 3: Configure Vault Structure
1. **Update layer_2 config** with new root token
2. **Deploy layer_2** to create Vault policies and backends:
   ```bash
   cd layer_2
   pulumi config set --secret layer_2:root-vault-token <NEW_ROOT_TOKEN>
   pulumi up
   ```

### Phase 4: Populate Secrets
1. **Get Vault tokens** from layer_2 outputs for platform access
2. **Restore manual OAuth secrets**:
   ```bash
   export VAULT_ADDR="https://vault.spr.ocket.cloud"
   export VAULT_TOKEN="<platform_token>"

   # For each environment and service, restore the secrets
   vault kv put platform/dev/manual/oauth/google clientId="..." clientSecret="..."
   vault kv put platform/dev/manual/oauth/epic clientId="..." clientSecret="..."
   # ... etc for all extracted secrets
   ```

### Phase 5: Deploy Platform
1. **Deploy platform stacks** - they should now be able to access Vault secrets:
   ```bash
   cd platform
   pulumi stack select dev && pulumi up
   pulumi stack select main && pulumi up
   pulumi stack select staging && pulumi up
   ```

## Key Considerations

- **Vault backends**: Your setup has `infrastructure`, `platform`, `misc`, and `database` backends
- **GitHub auth**: VaultGithubAuth is configured but you'll need to set it up again
- **Token refresh**: The `refresh-vault-tokens.sh` script suggests tokens get rotated
- **S3 path**: Vault data is stored at `vault_storage` path in your S3 bucket

## Critical Dependencies
- The platform services cannot deploy without Vault secrets
- OAuth functionality will be broken until secrets are restored
- Database dynamic credentials may need reconfiguration

# PostgreSQL Migration

- Remove postgres service standup in Pulumi project (layer_1)
- Add DO Managed PostgreSQL credentials to Pulumi stack "prod" (platform)

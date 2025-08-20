#!/bin/bash

# Vault Restoration Workflow
# This script helps restore your Vault setup from the old instance to the new one

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NEW_VAULT_ROOT_TOKEN="hvs.4zYTapBn9LJUHFWWGYA1W7i7"
NEW_VAULT_ADDR="http://vault-init.spr.ocket.cloud"
OLD_VAULT_ADDR="https://vault.spr.ocket.cloud"
SECRETS_BACKUP_DIR="./vault-secrets-backup"

echo -e "${BLUE}=== Vault Restoration Workflow ===${NC}"
echo ""

# Function to show menu
show_menu() {
    echo -e "${YELLOW}Select an option:${NC}"
    echo "1) Configure layer_2 with new root token"
    echo "2) Extract secrets from old vault (requires old vault access)"
    echo "3) Restore secrets to new vault"
    echo "4) Run complete restoration workflow"
    echo "5) Exit"
    echo ""
}

# Function to configure layer_2
configure_layer2() {
    echo -e "${GREEN}=== Phase 1: Configuring layer_2 with root token ===${NC}"
    
    cd layer_2
    
    echo "Setting root-vault-token in layer_2..."
    pulumi config set --secret layer_2:root-vault-token "$NEW_VAULT_ROOT_TOKEN"
    
    echo "Deploying layer_2 to create Vault backends and policies..."
    pulumi up --yes
    
    echo -e "${GREEN}✓ layer_2 configured successfully${NC}"
    echo ""
    cd ..
}

# Function to extract secrets from old vault
extract_old_secrets() {
    echo -e "${GREEN}=== Phase 2: Extracting secrets from old vault ===${NC}"
    
    # Check authentication method
    if [ -n "$OLD_VAULT_TOKEN" ]; then
        echo "Using vault token authentication..."
        AUTH_METHOD="token"
    elif [ -n "$GITHUB_PAT" ]; then
        echo "Using GitHub PAT authentication..."
        AUTH_METHOD="github"
        
        # Authenticate with GitHub
        echo "Authenticating with GitHub..."
        vault auth -address="$OLD_VAULT_ADDR" -method=github token="$GITHUB_PAT"
        
        if [ $? -ne 0 ]; then
            echo -e "${RED}GitHub authentication failed${NC}"
            return 1
        fi
    else
        echo -e "${RED}Please set either OLD_VAULT_TOKEN or GITHUB_PAT environment variable${NC}"
        echo "For GitHub PAT: export GITHUB_PAT=ghp_xxx"
        echo "For Vault token: export OLD_VAULT_TOKEN=hvs.xxx"
        return 1
    fi
    
    mkdir -p "$SECRETS_BACKUP_DIR"
    
    echo "Extracting OAuth secrets for each environment..."
    for env in dev main staging; do
        echo "  Extracting $env environment secrets..."
        
        # OAuth secrets
        vault kv get -address="$OLD_VAULT_ADDR" -format=json "platform/$env/manual/oauth/google" > "$SECRETS_BACKUP_DIR/google-$env.json" 2>/dev/null || echo "    Warning: google-$env not found"
        vault kv get -address="$OLD_VAULT_ADDR" -format=json "platform/$env/manual/oauth/epic" > "$SECRETS_BACKUP_DIR/epic-$env.json" 2>/dev/null || echo "    Warning: epic-$env not found"
        vault kv get -address="$OLD_VAULT_ADDR" -format=json "platform/$env/manual/oauth/steam" > "$SECRETS_BACKUP_DIR/steam-$env.json" 2>/dev/null || echo "    Warning: steam-$env not found"
        vault kv get -address="$OLD_VAULT_ADDR" -format=json "platform/$env/manual/oauth/discord" > "$SECRETS_BACKUP_DIR/discord-$env.json" 2>/dev/null || echo "    Warning: discord-$env not found"
        
        # Chatwoot secrets
        vault kv get -address="$OLD_VAULT_ADDR" -format=json "platform/$env/chatwoot" > "$SECRETS_BACKUP_DIR/chatwoot-$env.json" 2>/dev/null || echo "    Warning: chatwoot-$env not found"
    done
    
    echo "Extracting shared secrets..."
    vault kv get -address="$OLD_VAULT_ADDR" -format=json "platform/ballchasing" > "$SECRETS_BACKUP_DIR/ballchasing.json" 2>/dev/null || echo "  Warning: ballchasing not found"
    
    echo "Extracting infrastructure secrets..."
    vault kv list -address="$OLD_VAULT_ADDR" "infrastructure/" > "$SECRETS_BACKUP_DIR/infrastructure-paths.txt" 2>/dev/null || echo "  Warning: infrastructure/ not accessible"
    
    echo -e "${GREEN}✓ Secrets extracted to $SECRETS_BACKUP_DIR${NC}"
    echo ""
}

# Function to restore secrets to new vault
restore_secrets() {
    echo -e "${GREEN}=== Phase 3: Restoring secrets to new vault ===${NC}"
    
    if [ ! -d "$SECRETS_BACKUP_DIR" ]; then
        echo -e "${RED}Secrets backup directory not found. Run extraction first.${NC}"
        return 1
    fi
    
    # Get platform token from layer_2 output
    cd layer_2
    PLATFORM_TOKEN=$(pulumi stack output policies-platform-token --show-secrets 2>/dev/null || echo "")
    cd ..
    
    if [ -z "$PLATFORM_TOKEN" ]; then
        echo -e "${RED}Could not get platform token from layer_2. Make sure layer_2 is deployed.${NC}"
        return 1
    fi
    
    echo "Using platform token for secret restoration..."
    
    # Restore OAuth secrets for each environment
    for env in dev main staging; do
        echo "  Restoring $env environment secrets..."
        
        # Google OAuth
        if [ -f "$SECRETS_BACKUP_DIR/google-$env.json" ]; then
            CLIENT_ID=$(jq -r '.data.data.clientId // .data.clientId // empty' "$SECRETS_BACKUP_DIR/google-$env.json")
            CLIENT_SECRET=$(jq -r '.data.data.clientSecret // .data.clientSecret // empty' "$SECRETS_BACKUP_DIR/google-$env.json")
            if [ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ]; then
                vault kv put -address="$NEW_VAULT_ADDR" -token="$PLATFORM_TOKEN" "platform/$env/manual/oauth/google" clientId="$CLIENT_ID" clientSecret="$CLIENT_SECRET"
                echo "    ✓ Google OAuth restored for $env"
            fi
        fi
        
        # Epic OAuth
        if [ -f "$SECRETS_BACKUP_DIR/epic-$env.json" ]; then
            CLIENT_ID=$(jq -r '.data.data.clientId // .data.clientId // empty' "$SECRETS_BACKUP_DIR/epic-$env.json")
            CLIENT_SECRET=$(jq -r '.data.data.clientSecret // .data.clientSecret // empty' "$SECRETS_BACKUP_DIR/epic-$env.json")
            if [ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ]; then
                vault kv put -address="$NEW_VAULT_ADDR" -token="$PLATFORM_TOKEN" "platform/$env/manual/oauth/epic" clientId="$CLIENT_ID" clientSecret="$CLIENT_SECRET"
                echo "    ✓ Epic OAuth restored for $env"
            fi
        fi
        
        # Steam OAuth
        if [ -f "$SECRETS_BACKUP_DIR/steam-$env.json" ]; then
            API_KEY=$(jq -r '.data.data.apiKey // .data.apiKey // empty' "$SECRETS_BACKUP_DIR/steam-$env.json")
            if [ -n "$API_KEY" ]; then
                vault kv put -address="$NEW_VAULT_ADDR" -token="$PLATFORM_TOKEN" "platform/$env/manual/oauth/steam" apiKey="$API_KEY"
                echo "    ✓ Steam OAuth restored for $env"
            fi
        fi
        
        # Discord OAuth
        if [ -f "$SECRETS_BACKUP_DIR/discord-$env.json" ]; then
            CLIENT_ID=$(jq -r '.data.data.client_id // .data.client_id // empty' "$SECRETS_BACKUP_DIR/discord-$env.json")
            CLIENT_SECRET=$(jq -r '.data.data.client_secret // .data.client_secret // empty' "$SECRETS_BACKUP_DIR/discord-$env.json")
            if [ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ]; then
                vault kv put -address="$NEW_VAULT_ADDR" -token="$PLATFORM_TOKEN" "platform/$env/manual/oauth/discord" client_id="$CLIENT_ID" client_secret="$CLIENT_SECRET"
                echo "    ✓ Discord OAuth restored for $env"
            fi
        fi
        
        # Chatwoot
        if [ -f "$SECRETS_BACKUP_DIR/chatwoot-$env.json" ]; then
            HMAC_KEY=$(jq -r '.data.data.hmacKey // .data.hmacKey // empty' "$SECRETS_BACKUP_DIR/chatwoot-$env.json")
            if [ -n "$HMAC_KEY" ]; then
                vault kv put -address="$NEW_VAULT_ADDR" -token="$PLATFORM_TOKEN" "platform/$env/chatwoot" hmacKey="$HMAC_KEY"
                echo "    ✓ Chatwoot restored for $env"
            fi
        fi
    done
    
    # Restore shared secrets
    if [ -f "$SECRETS_BACKUP_DIR/ballchasing.json" ]; then
        TOKEN=$(jq -r '.data.data.token // .data.token // empty' "$SECRETS_BACKUP_DIR/ballchasing.json")
        if [ -n "$TOKEN" ]; then
            vault kv put -address="$NEW_VAULT_ADDR" -token="$PLATFORM_TOKEN" "platform/ballchasing" token="$TOKEN"
            echo "  ✓ Ballchasing API token restored"
        fi
    fi
    
    echo -e "${GREEN}✓ Secrets restoration completed${NC}"
    echo ""
}

# Function to run complete workflow
complete_workflow() {
    echo -e "${BLUE}=== Running Complete Vault Restoration Workflow ===${NC}"
    echo ""
    
    configure_layer2
    
    echo -e "${YELLOW}Before proceeding to secret extraction:${NC}"
    echo "1. Make sure someone has unsealed the old vault"
    echo "2. Set either OLD_VAULT_TOKEN or GITHUB_PAT environment variable:"
    echo "   For GitHub PAT: export GITHUB_PAT=ghp_xxx"
    echo "   For Vault token: export OLD_VAULT_TOKEN=hvs.xxx"
    echo ""
    read -p "Press Enter when ready to continue with secret extraction..."
    
    extract_old_secrets
    restore_secrets
    
    echo -e "${GREEN}=== Vault Restoration Complete! ===${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Deploy platform stacks: cd platform && pulumi stack select dev && pulumi up"
    echo "2. Test that all services can access their secrets"
    echo "3. Re-enable HTTPS for Vault (revert temporary changes)"
    echo ""
}

# Main menu loop
while true; do
    show_menu
    read -p "Enter your choice [1-5]: " choice
    
    case $choice in
        1)
            configure_layer2
            ;;
        2)
            extract_old_secrets
            ;;
        3)
            restore_secrets
            ;;
        4)
            complete_workflow
            ;;
        5)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option. Please choose 1-5.${NC}"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
done
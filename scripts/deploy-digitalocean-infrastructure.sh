#!/bin/bash
set -e

# SprocketBot DigitalOcean Infrastructure Deployment Script
# This script deploys the DigitalOcean infrastructure (droplets, load balancer, VPC, etc.)
# Run this script on your LOCAL MACHINE where you have this repository

echo "🌊 SprocketBot DigitalOcean Infrastructure Deployment"
echo "===================================================="
echo ""

# Check if we're in the right directory structure
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ ! -f "$REPO_ROOT/digitalocean-platform/Pulumi.yaml" ]]; then
    echo "❌ Error: digitalocean-platform directory not found"
    echo "Script location: $SCRIPT_DIR"
    echo "Looking for: $REPO_ROOT/digitalocean-platform/Pulumi.yaml"
    echo ""
    echo "Please ensure you're running this script from the sprocket-infra repository"
    echo "and that the digitalocean-platform directory exists"
    exit 1
fi

# Check required tools
command -v pulumi >/dev/null 2>&1 || { echo "❌ Error: Pulumi CLI is required but not installed. See: https://www.pulumi.com/docs/get-started/install/"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ Error: Node.js/npm is required but not installed. See: https://nodejs.org/"; exit 1; }

# Check environment variables
if [[ -z "$DIGITALOCEAN_TOKEN" ]]; then
    echo "❌ Error: DIGITALOCEAN_TOKEN environment variable is required"
    echo "Get your token from: https://cloud.digitalocean.com/account/api/tokens"
    echo "Then run: export DIGITALOCEAN_TOKEN='your_token_here'"
    exit 1
fi

if [[ -z "$DOPPLER_TOKEN" ]]; then
    echo "❌ Error: DOPPLER_TOKEN environment variable is required"
    echo "Get your token from your Doppler project settings"
    echo "Then run: export DOPPLER_TOKEN='your_token_here'"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Navigate to digitalocean-platform directory
cd "$REPO_ROOT/digitalocean-platform"

# Install dependencies 
echo "📦 Installing/updating dependencies..."
npm install

# Verify Pulumi SDK is available
echo "🔍 Verifying Pulumi SDK installation..."
if ! npm list @pulumi/pulumi >/dev/null 2>&1; then
    echo "❌ Error: @pulumi/pulumi not found in node_modules"
    echo "Attempting to fix..."
    npm install @pulumi/pulumi @pulumi/digitalocean @pulumi/random @pulumiverse/doppler
fi

# Verify Pulumi SDK is working
echo "🔍 Testing Pulumi SDK..."
if node -e "import('@pulumi/pulumi').then(() => console.log('✅ Pulumi SDK is available')).catch(e => { console.error('❌ Pulumi SDK error:', e.message); process.exit(1); })" 2>/dev/null; then
    echo "✅ Pulumi SDK verified"
else
    echo "⚠️ ES module import failed, trying CommonJS..."
    if node -e "try { require('@pulumi/pulumi'); console.log('✅ Pulumi SDK is available (CommonJS)'); } catch(e) { console.error('❌ Pulumi SDK error:', e.message); process.exit(1); }"; then
        echo "✅ Pulumi SDK verified"
    else
        echo "❌ Pulumi SDK verification failed"
        echo "Troubleshooting:"
        echo "1. Node.js version: $(node --version)"
        echo "2. NPM version: $(npm --version)"
        echo "3. Pulumi CLI version: $(pulumi version)"
        echo "4. Directory contents:"
        ls -la
        echo "5. Package.json:"
        cat package.json
        exit 1
    fi
fi

# Use local backend
echo "🔧 Configuring Pulumi backend..."
pulumi login --local

# Create or select stack
echo "📝 Setting up Pulumi stack..."
pulumi stack init digitalocean 2>/dev/null || pulumi stack select digitalocean

# Configure providers
echo "🔑 Configuring providers..."
pulumi config set digitalocean:token --secret "$DIGITALOCEAN_TOKEN"
pulumi config set doppler-token --secret "$DOPPLER_TOKEN"

# Check for SSH key
echo "🔑 SSH Key Configuration"
echo "======================="

# Look for SSH public keys (try common types)
SSH_KEY_PATHS=("$HOME/.ssh/id_ed25519.pub" "$HOME/.ssh/id_rsa.pub" "$HOME/.ssh/id_ecdsa.pub")
SSH_KEY_PATH=""
SSH_KEY_ID=$(pulumi config get ssh-key-id 2>/dev/null || echo "")

# Find the first available SSH key
for key_path in "${SSH_KEY_PATHS[@]}"; do
    if [[ -f "$key_path" ]]; then
        SSH_KEY_PATH="$key_path"
        break
    fi
done

if [[ -z "$SSH_KEY_ID" ]]; then
    if [[ -n "$SSH_KEY_PATH" ]]; then
        echo "Found SSH public key at: $SSH_KEY_PATH"
        read -p "Use this SSH key for droplets? (y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Create SSH key in DigitalOcean if it doesn't exist
            SSH_KEY_CONTENT=$(cat "$SSH_KEY_PATH")
            SSH_KEY_NAME="sprocketbot-$(whoami)-$(date +%s)"
            
            echo "📤 Uploading SSH key to DigitalOcean..."
            if command -v doctl >/dev/null 2>&1; then
                # Try to create the key, capture the output to get the ID
                echo "🔍 Creating SSH key '$SSH_KEY_NAME'..."
                set +e  # Temporarily disable exit on error
                SSH_KEY_OUTPUT=$(doctl compute ssh-key create "$SSH_KEY_NAME" --public-key "$SSH_KEY_CONTENT" --format ID --no-header 2>&1)
                CREATE_EXIT_CODE=$?
                set -e  # Re-enable exit on error
                
                if [[ $CREATE_EXIT_CODE -eq 0 && -n "$SSH_KEY_OUTPUT" && "$SSH_KEY_OUTPUT" =~ ^[0-9]+$ ]]; then
                    SSH_KEY_ID="$SSH_KEY_OUTPUT"
                    echo "✅ Created new SSH key with ID: $SSH_KEY_ID"
                else
                    # Key might already exist, try to find it
                    echo "⚠️ SSH key creation failed (exit code: $CREATE_EXIT_CODE), checking existing keys..."
                    echo "   Create output: $SSH_KEY_OUTPUT"
                    
                    # Try to find existing key with similar content
                    set +e  # Temporarily disable exit on error
                    SSH_KEY_FINGERPRINT=$(ssh-keygen -lf "$SSH_KEY_PATH" | awk '{print $2}')
                    SSH_KEY_ID=$(doctl compute ssh-key list --format ID,Fingerprint --no-header | grep "$SSH_KEY_FINGERPRINT" | awk '{print $1}' | head -1)
                    set -e  # Re-enable exit on error
                    
                    if [[ -n "$SSH_KEY_ID" ]]; then
                        echo "✅ Found existing SSH key with matching fingerprint, ID: $SSH_KEY_ID"
                    else
                        echo "❌ Could not create or find SSH key"
                        echo "   Available SSH keys:"
                        set +e
                        doctl compute ssh-key list --format ID,Name,Fingerprint || echo "   Failed to list keys"
                        set -e
                        read -p "Enter your SSH key ID from DigitalOcean: " SSH_KEY_ID
                    fi
                fi
            else
                echo "⚠️ doctl not found - you need to manually add your SSH key to DigitalOcean"
                echo "   Public key content: $(cat "$SSH_KEY_PATH")"
                echo "   After adding it to DigitalOcean, find the ID from: https://cloud.digitalocean.com/account/security"
                read -p "Enter your SSH key ID from DigitalOcean: " SSH_KEY_ID
            fi
            
            if [[ -n "$SSH_KEY_ID" ]]; then
                pulumi config set ssh-key-id "$SSH_KEY_ID"
                echo "✅ SSH key configured with ID: $SSH_KEY_ID"
            else
                echo "❌ No SSH key ID provided, continuing without SSH key"
            fi
        fi
    else
        echo "No SSH public keys found in ~/.ssh/ (checked: ed25519, rsa, ecdsa)"
        echo "⚠️ Without SSH keys, you'll need to reset root passwords manually"
        read -p "Continue without SSH keys? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Generate an SSH key with: ssh-keygen -t ed25519"
            exit 1
        fi
    fi
else
    echo "Using existing SSH key ID: $SSH_KEY_ID"
fi

echo "🔄 Continuing to infrastructure configuration..."

# Get configuration
echo ""
echo "⚙️ Infrastructure Configuration"
echo "==============================="

# Check if config already exists
REGION=$(pulumi config get region 2>/dev/null || echo "")
if [[ -z "$REGION" ]]; then
    echo "Setting up initial configuration..."
    read -p "Enter DigitalOcean region [nyc3]: " REGION
    REGION=${REGION:-nyc3}
    
    read -p "Enter manager droplet size [s-4vcpu-8gb]: " MANAGER_SIZE
    MANAGER_SIZE=${MANAGER_SIZE:-s-4vcpu-8gb}
    
    read -p "Enter worker droplet size [s-2vcpu-4gb]: " WORKER_SIZE
    WORKER_SIZE=${WORKER_SIZE:-s-2vcpu-4gb}
    
    read -p "Enter number of worker nodes [2]: " WORKER_COUNT
    WORKER_COUNT=${WORKER_COUNT:-2}
    
    # Save configuration
    pulumi config set region "$REGION"
    pulumi config set manager-size "$MANAGER_SIZE"
    pulumi config set worker-size "$WORKER_SIZE"
    pulumi config set worker-count "$WORKER_COUNT"
    
    echo ""
    echo "Configuration saved!"
else
    echo "Using existing configuration:"
    echo "Region: $(pulumi config get region)"
    echo "Manager size: $(pulumi config get manager-size)"
    echo "Worker size: $(pulumi config get worker-size)"
    echo "Worker count: $(pulumi config get worker-count)"
    SSH_KEY_ID=$(pulumi config get ssh-key-id 2>/dev/null || echo "none")
    echo "SSH key ID: $SSH_KEY_ID"
fi

echo ""
echo "🔍 Configuration summary:"
echo "========================"
pulumi config

echo ""
echo "💰 Estimated monthly cost: ~$133 (manager: $48, 2 workers: $48, load balancer: $12, storage: $25)"
echo ""

read -p "Deploy DigitalOcean infrastructure? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 1
fi

echo ""
echo "🚀 Deploying DigitalOcean infrastructure..."
echo "==========================================="

# Deploy with Pulumi
pulumi up --yes

# Get outputs
echo ""
echo "📋 Deployment Information:"
echo "=========================="
MANAGER_IP=$(pulumi stack output managerIp)
LOAD_BALANCER_IP=$(pulumi stack output loadBalancerIp)

echo "Manager IP: $MANAGER_IP"
echo "Load Balancer IP: $LOAD_BALANCER_IP"

# Save deployment info for later use (always overwrite to ensure current IPs)
cat > "$REPO_ROOT/deployment-info.txt" << EOF
# SprocketBot DigitalOcean Deployment Information
# Generated on $(date)

MANAGER_IP=$MANAGER_IP
LOAD_BALANCER_IP=$LOAD_BALANCER_IP
REGION=$(pulumi config get region)
EOF

echo ""
echo "✅ DigitalOcean infrastructure deployed successfully!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Update your DNS records:"
echo "   - Point *.yourdomain.com to: $LOAD_BALANCER_IP"
echo ""
echo "2. Join workers to Docker Swarm:"
echo "   ./scripts/join-swarm-workers-simple.sh"
echo ""
echo "3. Deploy application services:"
echo "   scp scripts/deploy-*.sh root@$MANAGER_IP:/root/"
echo "   ssh root@$MANAGER_IP"
echo "   cd /root && ./deploy-infrastructure.sh"
echo ""
echo "🔒 Infrastructure details saved in: deployment-info.txt"
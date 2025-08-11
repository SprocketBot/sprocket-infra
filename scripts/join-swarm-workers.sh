#!/bin/bash
set -e

echo "🔗 Joining worker nodes to Docker Swarm..."

cd "$(dirname "$0")/../digitalocean-platform"

# Get outputs from Pulumi
echo "📋 Getting deployment information..."
echo "🔍 Current directory: $(pwd)"
echo "🔍 Checking Pulumi stack status..."

# Check if we're in the right directory
if [[ ! -f "Pulumi.yaml" ]]; then
    echo "❌ Error: Not in Pulumi project directory"
    echo "   Looking for Pulumi.yaml in: $(pwd)"
    echo "   Available files:"
    ls -la
    exit 1
fi

echo "🔍 Checking Pulumi stack..."
pulumi stack ls
echo "🔍 Current stack:"
pulumi stack select digitalocean 2>/dev/null || echo "No digitalocean stack selected"

echo "🔍 Getting manager IP..."
MANAGER_IP=$(timeout 30 pulumi stack output managerIp 2>&1)
PULUMI_EXIT_CODE=$?
if [[ $PULUMI_EXIT_CODE -ne 0 ]]; then
    echo "❌ Error getting manager IP (exit code: $PULUMI_EXIT_CODE)"
    echo "   Output: $MANAGER_IP"
    echo "🔍 Available stack outputs:"
    pulumi stack output 2>&1 || echo "Could not list outputs"
    exit 1
fi

echo "🔍 Getting load balancer IP..."
LOAD_BALANCER_IP=$(timeout 30 pulumi stack output loadBalancerIp 2>&1)
if [[ $? -ne 0 ]]; then
    echo "❌ Error getting load balancer IP: $LOAD_BALANCER_IP"
    exit 1
fi

if [ -z "$MANAGER_IP" ]; then
    echo "❌ Error: Could not get manager IP from Pulumi outputs"
    echo "   Make sure the deployment completed successfully"
    exit 1
fi

echo "🖥️  Manager IP: $MANAGER_IP"
echo "⚖️  Load Balancer IP: $LOAD_BALANCER_IP"
echo ""

# SSH to manager and get join token
echo "🔑 Getting worker join token from manager..."
echo "🔍 Testing SSH connection to manager..."
if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$MANAGER_IP "echo 'SSH connection successful'"; then
    echo "❌ Error: Cannot SSH to manager node at $MANAGER_IP"
    echo "   Check if SSH keys are properly configured"
    exit 1
fi

echo "🔍 Getting join token..."
ssh -o StrictHostKeyChecking=no root@$MANAGER_IP "docker swarm join-token worker -q" > /tmp/worker-token 2>&1

if [ ! -s /tmp/worker-token ]; then
    echo "❌ Error: Could not retrieve worker join token"
    echo "   Manager response:"
    cat /tmp/worker-token
    exit 1
fi

JOIN_TOKEN=$(cat /tmp/worker-token)
echo "✅ Got worker join token: ${JOIN_TOKEN:0:20}..."

# Get manager's private IP for join command
echo "🔍 Getting manager's private IP..."
MANAGER_PRIVATE_IP=$(ssh -o StrictHostKeyChecking=no root@$MANAGER_IP "curl -s http://169.254.169.254/metadata/v1/interfaces/private/0/ipv4/address")

if [ -z "$MANAGER_PRIVATE_IP" ]; then
    echo "❌ Error: Could not get manager's private IP"
    exit 1
fi

echo "🔗 Manager private IP: $MANAGER_PRIVATE_IP"

# Get worker IPs from Pulumi outputs
echo "📋 Getting worker node IPs from Pulumi..."
WORKER_IPS_JSON=$(pulumi stack output workerIps --json 2>/dev/null)

if [ -z "$WORKER_IPS_JSON" ]; then
    echo "❌ Error: Could not get worker IPs from Pulumi outputs"
    echo "   Make sure the deployment completed successfully"
    exit 1
fi

echo "🔍 Raw worker IPs JSON: $WORKER_IPS_JSON"
WORKER_IPS=$(echo "$WORKER_IPS_JSON" | jq -r '.[]' 2>/dev/null)
echo "🔍 Parsed worker IPs:"
echo "$WORKER_IPS"

# Join each worker to the swarm
worker_count=0
for ip in $WORKER_IPS; do
    if [ ! -z "$ip" ] && [ "$ip" != "null" ]; then
        worker_count=$((worker_count + 1))
        echo ""
        echo "🔗 Joining worker $worker_count ($ip)"
        
        # Test SSH connection to worker
        echo "🔍 Testing SSH connection to worker..."
        if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "echo 'Worker SSH successful'"; then
            echo "❌ Error: Cannot SSH to worker node at $ip"
            echo "   Check if SSH keys are properly configured"
            continue
        fi
        
        # First, make sure the worker leaves any existing swarm
        echo "🔄 Ensuring worker is not in an existing swarm..."
        ssh -o StrictHostKeyChecking=no root@$ip "docker swarm leave --force" 2>/dev/null || true
        
        # Join the worker to the swarm
        echo "🔗 Executing join command..."
        if ssh -o StrictHostKeyChecking=no root@$ip "docker swarm join --token $JOIN_TOKEN $MANAGER_PRIVATE_IP:2377"; then
            echo "✅ Successfully joined worker $worker_count to the swarm"
        else
            echo "❌ Failed to join worker $worker_count to the swarm"
            echo "🔍 Checking worker Docker status..."
            ssh -o StrictHostKeyChecking=no root@$ip "systemctl status docker --no-pager" || echo "Could not check Docker status"
        fi
    fi
done

if [ $worker_count -eq 0 ]; then
    echo "❌ No worker nodes found to join"
    exit 1
fi

echo ""
echo "🔍 Verifying swarm status..."
ssh -o StrictHostKeyChecking=no root@$MANAGER_IP "docker node ls"

echo ""
echo "✅ Swarm setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Update your DNS to point to: $LOAD_BALANCER_IP"
echo "   2. Deploy your services using: docker stack deploy"
echo "   3. Monitor services with: docker service ls"
echo ""
echo "🌐 Your load balancer is ready at: $LOAD_BALANCER_IP"

# Cleanup
rm -f /tmp/worker-token
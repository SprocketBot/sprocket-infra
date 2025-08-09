#!/bin/bash
set -e

echo "🔗 Joining worker nodes to Docker Swarm..."

# Get deployment information from saved file
REPO_ROOT="$(dirname "$0")/.."
if [[ ! -f "$REPO_ROOT/deployment-info.txt" ]]; then
    echo "❌ Error: deployment-info.txt not found"
    echo "   Please run the infrastructure deployment script first"
    exit 1
fi

echo "📋 Loading deployment information..."
echo "🔍 Reading from: $REPO_ROOT/deployment-info.txt"
echo "🔍 File contents:"
cat "$REPO_ROOT/deployment-info.txt"

echo "🔍 Sourcing variables..."
source "$REPO_ROOT/deployment-info.txt"

echo "🔍 Variables loaded:"
echo "   MANAGER_IP='$MANAGER_IP'"
echo "   LOAD_BALANCER_IP='$LOAD_BALANCER_IP'"
echo "   REGION='$REGION'"

if [[ -z "$MANAGER_IP" ]]; then
    echo "❌ Error: MANAGER_IP not found in deployment-info.txt"
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

# Get worker IPs from deployment info (we know there should be 2)
echo "📋 Getting worker node IPs..."
echo "🔍 Looking up worker droplets..."

# Use doctl to get worker IPs (since we know doctl is configured now)
WORKER_IPS=$(doctl compute droplet list --tag-name sprocketbot --tag-name worker --format PublicIPv4 --no-header)

if [ -z "$WORKER_IPS" ]; then
    echo "❌ Error: Could not get worker IPs"
    echo "   Available droplets:"
    doctl compute droplet list --tag-name sprocketbot --format ID,Name,PublicIPv4,Tags
    exit 1
fi

echo "🔍 Found worker IPs:"
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
        
        # Test network connectivity to manager  
        echo "🔍 Testing network connectivity to manager..."
        echo "   Testing connectivity to $MANAGER_PRIVATE_IP:2377..."
        if ssh -o StrictHostKeyChecking=no root@$ip "timeout 5 nc -z $MANAGER_PRIVATE_IP 2377"; then
            echo "✅ Port 2377 is reachable from worker"
        else
            echo "❌ Port 2377 is NOT reachable from worker"
            echo "🔍 Worker can reach manager on other ports:"
            ssh -o StrictHostKeyChecking=no root@$ip "timeout 3 nc -z $MANAGER_PRIVATE_IP 22 && echo 'SSH (22): ✅' || echo 'SSH (22): ❌'"
        fi
        
        # Join the worker to the swarm
        echo "🔗 Executing join command..."
        if ssh -o StrictHostKeyChecking=no root@$ip "docker swarm join --token $JOIN_TOKEN $MANAGER_PRIVATE_IP:2377"; then
            echo "✅ Successfully joined worker $worker_count to the swarm"
        else
            echo "❌ Failed to join worker $worker_count to the swarm"
            echo "🔍 Checking worker Docker status..."
            ssh -o StrictHostKeyChecking=no root@$ip "systemctl status docker --no-pager" || echo "Could not check Docker status"
            echo "🔍 Checking if join is still in progress..."
            ssh -o StrictHostKeyChecking=no root@$ip "docker info | grep -E 'Swarm|Node'" || echo "Could not check swarm status"
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
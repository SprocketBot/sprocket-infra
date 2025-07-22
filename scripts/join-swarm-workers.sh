#!/bin/bash
set -e

echo "🔗 Joining worker nodes to Docker Swarm..."

cd "$(dirname "$0")/../digitalocean-platform"

# Get outputs from Pulumi
echo "📋 Getting deployment information..."
MANAGER_IP=$(pulumi stack output managerIp 2>/dev/null)
LOAD_BALANCER_IP=$(pulumi stack output loadBalancerIp 2>/dev/null)

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
ssh -o StrictHostKeyChecking=no root@$MANAGER_IP "docker swarm join-token worker -q" > /tmp/worker-token

if [ ! -s /tmp/worker-token ]; then
    echo "❌ Error: Could not retrieve worker join token"
    exit 1
fi

JOIN_TOKEN=$(cat /tmp/worker-token)
echo "✅ Got worker join token"

# Get manager's private IP for join command
echo "🔍 Getting manager's private IP..."
MANAGER_PRIVATE_IP=$(ssh -o StrictHostKeyChecking=no root@$MANAGER_IP "curl -s http://169.254.169.254/metadata/v1/interfaces/private/0/ipv4/address")

if [ -z "$MANAGER_PRIVATE_IP" ]; then
    echo "❌ Error: Could not get manager's private IP"
    exit 1
fi

echo "🔗 Manager private IP: $MANAGER_PRIVATE_IP"

# Get worker IPs from DigitalOcean
echo "📋 Getting worker node IPs..."
doctl compute droplet list --tag-name docker-swarm --tag-name worker --format ID,Name,PublicIPv4 --no-header | while IFS=$'\t' read -r id name ip; do
    if [ ! -z "$ip" ]; then
        echo ""
        echo "🔗 Joining worker: $name ($ip)"
        
        # Join the worker to the swarm
        if ssh -o StrictHostKeyChecking=no root@$ip "docker swarm join --token $JOIN_TOKEN $MANAGER_PRIVATE_IP:2377"; then
            echo "✅ Successfully joined $name to the swarm"
        else
            echo "❌ Failed to join $name to the swarm"
        fi
    fi
done

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
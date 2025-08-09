import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";
import * as random from "@pulumi/random";

const config = new pulumi.Config();

// Simple DigitalOcean infrastructure for SprocketBot
export class DigitalOceanInfrastructure extends pulumi.ComponentResource {
    public readonly vpc: digitalocean.Vpc;
    public readonly managerDroplet: digitalocean.Droplet;
    public readonly workerDroplets: digitalocean.Droplet[];
    public readonly loadBalancer: digitalocean.LoadBalancer;
    public readonly volumes: {
        postgres: digitalocean.Volume;
        minio: digitalocean.Volume;
        influx: digitalocean.Volume;
    };

    constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:DigitalOceanInfrastructure", name, {}, opts);

        const region = config.get("region") || "nyc3";
        const vpcCidr = "10.10.0.0/16";
        
        // Create VPC
        this.vpc = new digitalocean.Vpc(`${name}-vpc`, {
            region: region,
            ipRange: vpcCidr,
        }, { parent: this });

        // Create persistent volumes
        this.volumes = {
            postgres: new digitalocean.Volume(`${name}-postgres-data`, {
                region: region,
                size: 100,
                initialFilesystemType: "ext4",
                description: "PostgreSQL persistent storage"
            }, { parent: this }),
            
            minio: new digitalocean.Volume(`${name}-minio-data`, {
                region: region, 
                size: 100,
                initialFilesystemType: "ext4",
                description: "Minio object storage"
            }, { parent: this }),
            
            influx: new digitalocean.Volume(`${name}-influx-data`, {
                region: region,
                size: 50,
                initialFilesystemType: "ext4", 
                description: "InfluxDB time series data"
            }, { parent: this })
        };

        // Docker Swarm init script
        const swarmInitScript = `#!/bin/bash
set -e

# Update system
apt-get update
apt-get install -y curl jq

# Configure UFW for Docker Swarm ports
echo "Configuring UFW for Docker Swarm..."
ufw --force enable
ufw allow ssh
ufw allow 2377/tcp  # Docker Swarm management
ufw allow 7946/tcp  # Docker Swarm node communication (TCP)
ufw allow 7946/udp  # Docker Swarm node communication (UDP)
ufw allow 4789/udp  # Docker Swarm overlay network traffic
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 8080/tcp  # Health checks
echo "UFW configured for Docker Swarm"

# Wait for docker to be ready
while ! systemctl is-active --quiet docker; do
    echo "Waiting for Docker to start..."
    sleep 5
done

# Get private IP
PRIVATE_IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/private/0/ipv4/address)

# Initialize Docker Swarm
docker swarm init --advertise-addr $PRIVATE_IP

# Create directories for volume mounts
mkdir -p /mnt/postgres-data /mnt/minio-data /mnt/influx-data
chmod 755 /mnt/postgres-data /mnt/minio-data /mnt/influx-data

echo "Docker Swarm manager initialized"
`;

        // Get SSH key ID for droplets
        const sshKeyId = config.get("ssh-key-id");
        
        // Manager node
        this.managerDroplet = new digitalocean.Droplet(`${name}-manager`, {
            region: region,
            size: config.get("manager-size") || "s-4vcpu-8gb",
            image: "docker-20-04",
            vpcUuid: this.vpc.id,
            userData: swarmInitScript,
            tags: ["docker-swarm", "manager", "sprocketbot"],
            volumeIds: [
                this.volumes.postgres.id,
                this.volumes.minio.id,
                this.volumes.influx.id
            ],
            sshKeys: sshKeyId ? [sshKeyId] : [],
            monitoring: true,
            backups: true
        }, { parent: this });

        // Worker init script
        const workerInitScript = `#!/bin/bash
set -e

# Update system
apt-get update
apt-get install -y curl jq

# Configure UFW for Docker Swarm ports
echo "Configuring UFW for Docker Swarm on worker..."
ufw --force enable
ufw allow ssh
ufw allow 7946/tcp  # Docker Swarm node communication (TCP)
ufw allow 7946/udp  # Docker Swarm node communication (UDP)
ufw allow 4789/udp  # Docker Swarm overlay network traffic
echo "UFW configured for Docker Swarm worker"

echo "Docker Swarm worker ready for joining"
`;

        // Worker nodes
        this.workerDroplets = [];
        const workerCount = parseInt(config.get("worker-count") || "2");
        
        for (let i = 0; i < workerCount; i++) {
            this.workerDroplets.push(new digitalocean.Droplet(`${name}-worker-${i}`, {
                region: region,
                size: config.get("worker-size") || "s-2vcpu-4gb", 
                image: "docker-20-04",
                vpcUuid: this.vpc.id,
                userData: workerInitScript,
                tags: ["docker-swarm", "worker", "sprocketbot"],
                sshKeys: sshKeyId ? [sshKeyId] : [],
                monitoring: true
            }, { parent: this }));
        }

        // Load balancer - using TLS passthrough for now
        // Traefik will handle SSL termination with Let's Encrypt
        this.loadBalancer = new digitalocean.LoadBalancer(`${name}-lb`, {
            region: region,
            dropletTag: "docker-swarm",
            forwardingRules: [{
                entryPort: 80,
                entryProtocol: "http", 
                targetPort: 80,
                targetProtocol: "http",
            }, {
                entryPort: 443,
                entryProtocol: "https",
                targetPort: 443, 
                targetProtocol: "https",
                tlsPassthrough: true  // Let Traefik handle SSL
            }],
            healthcheck: {
                protocol: "http",
                port: 8080,
                path: "/ping"
            },
            redirectHttpToHttps: false  // Let Traefik handle redirects
        }, { parent: this });

        // Firewall - using tags instead of dropletIds to avoid type issues
        new digitalocean.Firewall(`${name}-firewall`, {
            tags: ["sprocketbot"],
            inboundRules: [
                // SSH
                {
                    protocol: "tcp",
                    portRange: "22",
                    sourceAddresses: ["0.0.0.0/0", "::/0"]
                },
                // HTTP/HTTPS from load balancer
                {
                    protocol: "tcp", 
                    portRange: "80",
                    sourceLoadBalancerUids: [this.loadBalancer.id]
                },
                {
                    protocol: "tcp",
                    portRange: "443", 
                    sourceLoadBalancerUids: [this.loadBalancer.id]
                },
                // Health check
                {
                    protocol: "tcp",
                    portRange: "8080",
                    sourceLoadBalancerUids: [this.loadBalancer.id]
                },
                // Docker Swarm (internal)
                {
                    protocol: "tcp",
                    portRange: "2377",
                    sourceAddresses: [vpcCidr]
                },
                {
                    protocol: "tcp",
                    portRange: "7946",
                    sourceAddresses: [vpcCidr]
                },
                {
                    protocol: "udp",
                    portRange: "7946",
                    sourceAddresses: [vpcCidr]
                },
                {
                    protocol: "udp", 
                    portRange: "4789",
                    sourceAddresses: [vpcCidr]
                }
            ],
            outboundRules: [
                {
                    protocol: "tcp",
                    portRange: "all",
                    destinationAddresses: ["0.0.0.0/0", "::/0"]
                },
                {
                    protocol: "udp",
                    portRange: "all", 
                    destinationAddresses: ["0.0.0.0/0", "::/0"]
                }
            ]
        }, { parent: this });
    }
}

// Create the infrastructure
const infrastructure = new DigitalOceanInfrastructure("sprocketbot");

// Export important values
export const vpcId = infrastructure.vpc.id;
export const managerIp = infrastructure.managerDroplet.ipv4Address;
export const loadBalancerIp = infrastructure.loadBalancer.ip;
export const managerPrivateIp = infrastructure.managerDroplet.ipv4AddressPrivate;
export const workerIps = infrastructure.workerDroplets.map(droplet => droplet.ipv4Address);
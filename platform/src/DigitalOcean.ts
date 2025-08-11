import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";

export interface DigitalOceanArgs {
    region?: string;
    managerSize?: string;
    workerSize?: string;
    workerCount?: number;
    vpcCidr?: string;
}

export class DigitalOcean extends pulumi.ComponentResource {
    public readonly vpc: digitalocean.Vpc;
    public readonly managerDroplet: digitalocean.Droplet;
    public readonly workerDroplets: digitalocean.Droplet[];
    public readonly loadBalancer: digitalocean.LoadBalancer;
    public readonly volumes: {
        postgres: digitalocean.Volume;
        minio: digitalocean.Volume;
        influx: digitalocean.Volume;
    };
    public readonly managerIp: pulumi.Output<string>;
    public readonly loadBalancerIp: pulumi.Output<string>;

    constructor(name: string, args: DigitalOceanArgs = {}, opts?: pulumi.ComponentResourceOptions) {
        super("SprocketBot:DigitalOcean", name, {}, opts);

        const region = args.region || "nyc3";
        const vpcCidr = args.vpcCidr || "10.10.0.0/16";
        
        // Create VPC for network isolation
        this.vpc = new digitalocean.Vpc(`${name}-vpc`, {
            region: region,
            ipRange: vpcCidr,
        }, { parent: this });

        // Create persistent volumes first
        this.volumes = {
            postgres: new digitalocean.Volume(`${name}-postgres-data`, {
                region: region,
                size: 100,
                filesystemType: "ext4",
                description: "PostgreSQL persistent storage"
            }, { parent: this }),
            
            minio: new digitalocean.Volume(`${name}-minio-data`, {
                region: region, 
                size: 100,
                filesystemType: "ext4",
                description: "Minio object storage"
            }, { parent: this }),
            
            influx: new digitalocean.Volume(`${name}-influx-data`, {
                region: region,
                size: 50,
                filesystemType: "ext4", 
                description: "InfluxDB time series data"
            }, { parent: this })
        };

        // Docker Swarm init script for manager
        const swarmInitScript = `#!/bin/bash
set -e

# Update system and install required packages
apt-get update
apt-get install -y curl jq

# Wait for docker to be ready
while ! systemctl is-active --quiet docker; do
    echo "Waiting for Docker to start..."
    sleep 5
done

# Get private IP
PRIVATE_IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/private/0/ipv4/address)

# Initialize Docker Swarm
docker swarm init --advertise-addr $PRIVATE_IP

# Get join tokens and save them
docker swarm join-token worker -q > /root/worker-token
docker swarm join-token manager -q > /root/manager-token

# Create directories for volume mounts
mkdir -p /mnt/postgres-data /mnt/minio-data /mnt/influx-data

# Set proper permissions
chmod 755 /mnt/postgres-data /mnt/minio-data /mnt/influx-data

echo "Docker Swarm manager initialized successfully"
`;

        // Docker Swarm manager node
        this.managerDroplet = new digitalocean.Droplet(`${name}-manager`, {
            region: region,
            size: args.managerSize || "s-4vcpu-8gb",
            image: "docker-20-04",
            vpcUuid: this.vpc.id,
            userData: swarmInitScript,
            tags: ["docker-swarm", "manager", "sprocketbot"],
            volumeIds: [
                this.volumes.postgres.id,
                this.volumes.minio.id,
                this.volumes.influx.id
            ],
            monitoring: true,
            backups: true
        }, { parent: this });

        // Worker nodes
        this.workerDroplets = [];
        const workerCount = args.workerCount || 2;
        
        for (let i = 0; i < workerCount; i++) {
            const workerScript = pulumi.interpolate`#!/bin/bash
set -e

# Update system
apt-get update
apt-get install -y curl

# Wait for docker to be ready
while ! systemctl is-active --quiet docker; do
    echo "Waiting for Docker to start..."
    sleep 5
done

# Wait for manager to be ready and get join token
echo "Waiting for manager node to initialize..."
sleep 60

# This would typically get the join token from the manager
# In production, you'd want to use a more secure method like:
# - Storing the token in a secret management service
# - Using cloud-init or similar to securely distribute tokens
echo "Worker node ready for manual join to swarm"
`;

            this.workerDroplets.push(new digitalocean.Droplet(`${name}-worker-${i}`, {
                region: region,
                size: args.workerSize || "s-2vcpu-4gb", 
                image: "docker-20-04",
                vpcUuid: this.vpc.id,
                userData: workerScript,
                tags: ["docker-swarm", "worker", "sprocketbot"],
                monitoring: true
            }, { parent: this }));
        }

        // Load balancer for ingress traffic
        this.loadBalancer = new digitalocean.LoadBalancer(`${name}-lb`, {
            region: region,
            dropletTag: "docker-swarm",
            algorithm: "round_robin",
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
                certificateName: "", // Will be configured separately for SSL
            }],
            healthcheck: {
                protocol: "http",
                port: 8080, // Traefik health check port
                path: "/ping"
            },
            redirectHttpToHttps: true
        }, { parent: this });

        // Firewall rules for the VPC
        new digitalocean.Firewall(`${name}-firewall`, {
            dropletIds: [
                this.managerDroplet.id,
                ...this.workerDroplets.map(w => w.id)
            ],
            inboundRules: [
                // SSH access
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
                // Traefik health check
                {
                    protocol: "tcp",
                    portRange: "8080",
                    sourceLoadBalancerUids: [this.loadBalancer.id]
                },
                // Docker Swarm ports (internal VPC only)
                {
                    protocol: "tcp",
                    portRange: "2377", // Swarm management
                    sourceAddresses: [vpcCidr]
                },
                {
                    protocol: "tcp",
                    portRange: "7946", // Container network discovery
                    sourceAddresses: [vpcCidr]
                },
                {
                    protocol: "udp",
                    portRange: "7946",
                    sourceAddresses: [vpcCidr]
                },
                {
                    protocol: "udp", 
                    portRange: "4789", // Container overlay network
                    sourceAddresses: [vpcCidr]
                }
            ],
            outboundRules: [
                // Allow all outbound traffic
                {
                    protocol: "tcp",
                    portRange: "all",
                    destinationAddresses: ["0.0.0.0/0", "::/0"]
                },
                {
                    protocol: "udp",
                    portRange: "all", 
                    destinationAddresses: ["0.0.0.0/0", "::/0"]
                },
                {
                    protocol: "icmp",
                    destinationAddresses: ["0.0.0.0/0", "::/0"]
                }
            ]
        }, { parent: this });

        // Export important values
        this.managerIp = this.managerDroplet.ipv4Address;
        this.loadBalancerIp = this.loadBalancer.ip;
    }
}

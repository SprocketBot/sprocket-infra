# DigitalOcean Migration Guide

This guide covers migrating SprocketBot infrastructure from a self-hosted cluster to DigitalOcean using Docker Swarm.

## Prerequisites

### Required Accounts & Access
- [ ] **DigitalOcean Account** with API access
- [ ] **DigitalOcean API Token** (Personal Access Token)
- [ ] **Doppler Account** with existing SprocketBot projects
- [ ] **Docker Registry Access** (GitHub Container Registry or DigitalOcean Container Registry)
- [ ] **DNS Provider Access** (to update domain records)

### Environment Variables
```bash
export DIGITALOCEAN_TOKEN="your_do_token_here"
export DOPPLER_TOKEN="your_doppler_token_here"
```

## Quick Start

### 1. Run Setup Script
```bash
./scripts/setup-digitalocean.sh
```

This script will:
- Configure Pulumi for DigitalOcean
- Set up basic stack configuration
- Prompt for required secrets

### 2. Deploy Infrastructure
```bash
cd platform
pulumi stack select digitalocean
pulumi up
```

### 3. Post-Deployment Setup
After successful deployment:

1. **Join Worker Nodes to Swarm**:
   ```bash
   # SSH to manager node
   ssh root@<manager-ip>
   
   # Get worker join token
   docker swarm join-token worker
   
   # SSH to each worker and run the join command
   ssh root@<worker-ip>
   docker swarm join --token <token> <manager-private-ip>:2377
   ```

2. **Update DNS Records**:
   - Point your domain to the load balancer IP
   - Verify DNS propagation

3. **Verify Deployment**:
   ```bash
   # Check services are running
   ssh root@<manager-ip>
   docker service ls
   ```

## Architecture Overview

### Infrastructure Components

#### DigitalOcean Resources Created
- **VPC**: Private network (10.10.0.0/16)
- **Manager Droplet**: Docker Swarm manager (s-4vcpu-8gb)
- **Worker Droplets**: Docker Swarm workers (s-2vcpu-4gb x2)
- **Load Balancer**: HTTP/HTTPS traffic distribution
- **Volumes**: Persistent storage for databases
  - PostgreSQL data (100GB)
  - Minio object storage (100GB)
  - InfluxDB time series (50GB)
- **Firewall**: Security rules for the cluster

#### Docker Swarm Configuration
- **Manager Node**: Hosts Swarm control plane + application services
- **Worker Nodes**: Run application workloads
- **Overlay Networks**: Container communication
- **Volume Mounts**: Persistent data storage

### Networking

#### Load Balancer Configuration
- **HTTP (80)** → **HTTP (80)** on droplets
- **HTTPS (443)** → **HTTPS (443)** on droplets
- **Health Check**: HTTP on port 8080 (/ping endpoint)

#### Firewall Rules
- **SSH (22)**: Open to internet for management
- **HTTP/HTTPS (80/443)**: From load balancer only
- **Docker Swarm**: Internal VPC communication
  - TCP 2377 (management)
  - TCP/UDP 7946 (discovery)  
  - UDP 4789 (overlay)

## Configuration Options

### Stack Configuration
```yaml
# Pulumi.digitalocean.yaml
config:
  platform:use-digital-ocean: "true"
  platform:do-region: "nyc3"           # DigitalOcean region
  platform:do-manager-size: "s-4vcpu-8gb"  # Manager droplet size
  platform:do-worker-size: "s-2vcpu-4gb"   # Worker droplet size  
  platform:do-worker-count: "2"            # Number of workers
  platform:subdomain: "do-test"            # Environment subdomain
  platform:hostname: "do.sprocketbot.gg"   # Base domain
```

### Available Droplet Sizes
- `s-1vcpu-1gb` - Basic (1 vCPU, 1GB RAM)
- `s-2vcpu-4gb` - Standard (2 vCPU, 4GB RAM)  
- `s-4vcpu-8gb` - Performance (4 vCPU, 8GB RAM)
- `s-8vcpu-16gb` - High Performance (8 vCPU, 16GB RAM)

### Available Regions
- `nyc1`, `nyc3` - New York
- `sfo3` - San Francisco
- `tor1` - Toronto
- `lon1` - London
- `fra1` - Frankfurt
- `sgp1` - Singapore

## Migration Checklist

### Pre-Migration
- [ ] DigitalOcean account setup and API token generated
- [ ] Doppler projects configured with production secrets
- [ ] DNS provider access confirmed
- [ ] Backup current infrastructure data
- [ ] Container images available in registry

### During Migration
- [ ] Run setup script: `./scripts/setup-digitalocean.sh`
- [ ] Review and adjust configuration as needed
- [ ] Deploy infrastructure: `pulumi up`
- [ ] Join worker nodes to Docker Swarm manually
- [ ] Verify all services are running
- [ ] Update DNS records to new load balancer

### Post-Migration
- [ ] Test all application functionality
- [ ] Verify monitoring and logging
- [ ] Update CI/CD pipelines if needed
- [ ] Document new infrastructure details
- [ ] Decommission old infrastructure

## Troubleshooting

### Common Issues

#### 1. Docker Swarm Connection Issues
```bash
# On manager node, check swarm status
docker node ls

# If nodes show as down, investigate networking
docker swarm join-token worker  # Get fresh token
```

#### 2. Load Balancer Health Checks Failing
```bash
# Verify Traefik is responding on health check port
curl http://<droplet-ip>:8080/ping

# Check Traefik logs
docker service logs traefik_traefik
```

#### 3. Volume Mount Issues
```bash
# Check volume attachment
lsblk

# Mount volumes manually if needed
mount /dev/disk/by-id/scsi-0DO_Volume_<volume-name> /mnt/<mount-point>
```

#### 4. DNS Resolution Problems
```bash
# Verify DNS propagation
dig your-domain.com
nslookup your-domain.com

# Check load balancer IP
doctl compute load-balancer list
```

### Getting Help

1. **Check Pulumi logs**: `pulumi logs`
2. **Review DigitalOcean console**: Monitor droplet and load balancer status
3. **SSH to manager node**: Direct troubleshooting of Docker services
4. **Check Doppler secrets**: Verify all required secrets are configured

## Production Considerations

### Security
- Enable private networking for all resources
- Use SSH keys instead of passwords
- Configure TLS certificates for Docker daemon
- Regular security updates for droplets

### Monitoring
- Set up DigitalOcean monitoring alerts
- Configure log aggregation for droplets
- Monitor load balancer health and performance
- Track resource usage and scaling needs

### Backup & Recovery
- Regular snapshots of droplet images
- Volume backups for persistent data
- Database backup automation
- Disaster recovery procedures

### Scaling
- Horizontal scaling: Add more worker nodes
- Vertical scaling: Resize existing droplets
- Load balancer scaling based on traffic
- Auto-scaling considerations for future

## Cost Optimization

### Resource Sizing
- Start with smaller droplets and scale up as needed
- Monitor CPU/memory usage to right-size
- Use block storage volumes efficiently
- Review and optimize load balancer usage

### Cost Monitoring
- Set up billing alerts in DigitalOcean
- Regular cost analysis and optimization
- Consider reserved instances for predictable workloads
- Monitor data transfer costs
# SprocketBot DigitalOcean Deployment Guide

This guide walks you through deploying SprocketBot infrastructure on DigitalOcean using Pulumi. This is a complete step-by-step process that anyone can follow, regardless of technical background.

## 📋 Prerequisites

### Required Accounts
1. **DigitalOcean Account** - [Sign up here](https://www.digitalocean.com/)
2. **Doppler Account** - [Sign up here](https://doppler.com/) (for secrets management)

### Required Software
1. **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
2. **Pulumi CLI** - [Install guide](https://www.pulumi.com/docs/get-started/install/)
3. **Git** - [Download here](https://git-scm.com/)

### Verify Installation
Open a terminal/command prompt and run:
```bash
node --version    # Should show v16.x.x or higher
pulumi version    # Should show pulumi version
git --version     # Should show git version
```

## 🔑 Setting Up Required Tokens

### 1. DigitalOcean API Token

**Step 1:** Log into your DigitalOcean account
**Step 2:** Go to API → Tokens → Generate New Token
**Step 3:** Create a token with these settings:
- **Name**: `SprocketBot Infrastructure`
- **Expiration**: Custom (set to 90 days or No expiry)
- **Scopes**: **Full Access** (read and write)

**Required Permissions:**
Your DigitalOcean token needs access to:
- ✅ **Droplets** (create, read, update, delete)
- ✅ **Load Balancers** (create, read, update, delete)
- ✅ **VPCs** (create, read, update, delete)
- ✅ **Volumes** (create, read, update, delete)
- ✅ **Firewalls** (create, read, update, delete)
- ✅ **Tags** (create, read, update, delete)

**Step 4:** Copy the token and save it securely - you'll need it in the next section.

### 2. Doppler Token

**Step 1:** Log into your Doppler account
**Step 2:** Navigate to your SprocketBot project
**Step 3:** Go to Access → Service Tokens
**Step 4:** Create a new service token:
- **Name**: `Infrastructure Deployment`
- **Access**: Read access to required environments
**Step 5:** Copy the token and save it securely

### 3. Discord Bot Token (Optional for testing)

**Step 1:** Go to [Discord Developer Portal](https://discord.com/developers/applications)
**Step 2:** Create a new application or use existing SprocketBot application
**Step 3:** Go to Bot section
**Step 4:** Copy the Bot Token

### 4. Container Registry Token

**Step 1:** Go to your container registry (GitHub Container Registry)
**Step 2:** Create a Personal Access Token with package permissions
**Step 3:** Copy the token

## 🚀 Deployment Process

### Step 1: Clone the Repository
```bash
git clone https://github.com/SprocketBot/sprocket-infra.git
cd sprocket-infra
```

### Step 2: Set Environment Variables

**On Windows (Command Prompt):**
```cmd
set DIGITALOCEAN_TOKEN=your_digitalocean_token_here
set DOPPLER_TOKEN=your_doppler_token_here
```

**On Windows (PowerShell):**
```powershell
$env:DIGITALOCEAN_TOKEN="your_digitalocean_token_here"
$env:DOPPLER_TOKEN="your_doppler_token_here"
```

**On macOS/Linux:**
```bash
export DIGITALOCEAN_TOKEN="your_digitalocean_token_here"
export DOPPLER_TOKEN="your_doppler_token_here"
```

### Step 3: Run the Setup Script

**On Windows:**
```bash
bash scripts/setup-digitalocean.sh
```

**On macOS/Linux:**
```bash
./scripts/setup-digitalocean.sh
```

**What the script does:**
1. Installs required Node.js dependencies
2. Configures Pulumi to use local backend (no cloud storage needed)
3. Sets up DigitalOcean provider credentials
4. Configures basic infrastructure settings
5. Prompts you for additional secrets (Discord bot token, container registry token)

**When prompted, enter:**
- **Discord Bot Token**: Your Discord bot token from Step 3 above
- **Container Registry Token**: Your container registry token from Step 4 above

### Step 4: Review Configuration

The script will show your current configuration. It should look like:
```
KEY                          VALUE
digitalocean:token          [secret]
doppler-token              [secret]
region                     nyc3
manager-size              s-4vcpu-8gb
worker-size               s-2vcpu-4gb
worker-count              2
discord-bot-token         [secret]
docker-access-token       [secret]
```

### Step 5: Deploy Infrastructure

```bash
cd digitalocean-platform
pulumi up
```

**What happens during deployment:**
1. Pulumi will show you a preview of all resources it will create
2. Type `yes` to confirm the deployment
3. Deployment takes about 5-10 minutes
4. You'll see progress as each resource is created

**Resources being created:**
- **VPC**: Private network for your infrastructure
- **Droplets**: 1 manager + 2 worker servers
- **Load Balancer**: Routes traffic to your services
- **Volumes**: Persistent storage (250GB total)
- **Firewall**: Security rules

### Step 6: Join Workers to Docker Swarm

After deployment completes successfully:
```bash
cd ..
./scripts/join-swarm-workers.sh
```

**What this script does:**
1. Gets the manager server IP from the deployment
2. SSH into the manager to get the worker join token
3. Automatically joins all worker servers to the Docker Swarm
4. Verifies the swarm is working correctly

### Step 7: Get Your Load Balancer IP

```bash
cd digitalocean-platform
pulumi stack output loadBalancerIp
```

**Save this IP address** - you'll need it for DNS configuration.

## 🌐 DNS Configuration

### Point Your Domain to DigitalOcean

**Step 1:** Log into your DNS provider (where you manage your domain)
**Step 2:** Update/create these DNS records:

```
Type    Name                    Value
A       sprocketbot.gg         YOUR_LOAD_BALANCER_IP
A       *.sprocketbot.gg       YOUR_LOAD_BALANCER_IP
```

**Step 3:** Wait for DNS propagation (usually 5-30 minutes)

**Step 4:** Test DNS resolution:
```bash
nslookup sprocketbot.gg
# Should return your load balancer IP
```

## ✅ Verification Checklist

After deployment, verify everything is working:

### Infrastructure Checks
- [ ] All Pulumi resources deployed successfully
- [ ] Load balancer is healthy in DigitalOcean console
- [ ] All droplets are running
- [ ] Volumes are attached to manager droplet

### Docker Swarm Checks
SSH into your manager node:
```bash
ssh root@YOUR_MANAGER_IP
```

Run these commands:
```bash
# Check swarm status
docker node ls
# Should show 1 manager + 2 workers

# Check networks
docker network ls
# Should show overlay networks

# Check volumes are mounted
df -h
# Should show mounted volumes
```

### DNS Checks
```bash
# Test your domain resolves to load balancer IP
nslookup YOUR_DOMAIN.com
ping YOUR_DOMAIN.com
```

## 🔧 Configuration Options

You can customize your deployment by modifying these settings before running `pulumi up`:

### Change Server Sizes
```bash
pulumi config set manager-size s-8vcpu-16gb    # Larger manager
pulumi config set worker-size s-4vcpu-8gb      # Larger workers
```

### Change Number of Workers
```bash
pulumi config set worker-count 3               # 3 worker nodes
```

### Change Region
```bash
pulumi config set region sfo3                  # San Francisco region
```

**Available Regions:**
- `nyc1`, `nyc3` - New York
- `sfo3` - San Francisco  
- `tor1` - Toronto
- `lon1` - London
- `fra1` - Frankfurt
- `sgp1` - Singapore

### Available Server Sizes
- `s-1vcpu-1gb` - $6/month - Basic
- `s-2vcpu-4gb` - $24/month - Standard  
- `s-4vcpu-8gb` - $48/month - Performance
- `s-8vcpu-16gb` - $96/month - High Performance

## 💰 Cost Estimation

**Monthly costs for default configuration:**
- Manager droplet (s-4vcpu-8gb): ~$48/month
- 2 Worker droplets (s-2vcpu-4gb each): ~$48/month
- Load balancer: ~$12/month
- 250GB volumes: ~$25/month
- **Total: ~$133/month**

## 🚨 Troubleshooting

### Common Issues

**Error: "InvalidAccessKeyId" or S3 backend errors**
- Solution: The script automatically uses local backend, but if you see this, run:
  ```bash
  pulumi login --local
  ```

**Error: "Load balancer HTTPS needs certificate"**
- This has been fixed in the current version
- If you see this, update your code and redeploy

**Error: "Permission denied" when running scripts**
- On Windows: Use `bash scripts/script-name.sh`
- On macOS/Linux: Run `chmod +x scripts/*.sh` first

**DNS not resolving**
- Wait up to 1 hour for global DNS propagation
- Use `nslookup` or `dig` to test resolution
- Check with your DNS provider's tools

**Can't SSH to droplets**
- Ensure your local IP is not blocked
- DigitalOcean droplets use SSH keys - add yours in DO console
- Try from a different network

**Deployment stuck or failed**
- Check DigitalOcean console for any resource limits
- Verify your account has sufficient credits
- Try deploying to a different region

### Getting Help

1. **Check DigitalOcean Console**: Look for any resource alerts or issues
2. **Review Pulumi Logs**: Run `pulumi logs` to see detailed error messages
3. **Check Droplet Console**: Use DigitalOcean's web console to access droplets
4. **Verify Tokens**: Ensure all tokens are valid and have correct permissions

### Support Resources
- **DigitalOcean Documentation**: https://docs.digitalocean.com/
- **Pulumi Documentation**: https://www.pulumi.com/docs/
- **Docker Swarm Documentation**: https://docs.docker.com/engine/swarm/

## 🔄 Updating Your Deployment

To update your infrastructure:

1. Make changes to the configuration:
   ```bash
   cd digitalocean-platform
   pulumi config set worker-count 3  # Example change
   ```

2. Preview changes:
   ```bash
   pulumi preview
   ```

3. Apply changes:
   ```bash
   pulumi up
   ```

## 🗑️ Cleanup (Destroying Infrastructure)

**⚠️ WARNING: This will permanently delete all your infrastructure and data!**

To completely remove your DigitalOcean infrastructure:

```bash
cd digitalocean-platform
pulumi destroy
```

Type `yes` when prompted. This will:
- Delete all droplets
- Delete the load balancer
- Delete all volumes (**data will be lost!**)
- Delete the VPC and firewall rules

## 📞 Support

If you encounter issues:

1. **Check this troubleshooting section first**
2. **Review DigitalOcean console** for any alerts
3. **Check Pulumi logs** with `pulumi logs`
4. **Verify all prerequisites** are met
5. **Contact your team** with specific error messages

---

**🎉 Congratulations!** You've successfully deployed SprocketBot infrastructure on DigitalOcean. Your Docker Swarm cluster is ready to run your applications with automatic scaling, load balancing, and persistent storage.
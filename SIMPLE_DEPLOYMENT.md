# Simple SprocketBot Deployment

This is the **easiest way** to deploy SprocketBot to DigitalOcean. Perfect for non-technical users!

## 📋 Prerequisites

- ✅ **DigitalOcean account** with API token
- ✅ **Doppler account** with project access
- ✅ **Domain name** (for your website)
- ✅ **Required credentials** (see below)

## 🔑 Required Information

Before starting, gather these credentials:

### **Cloud Providers**
- DigitalOcean API Token
- Doppler Token

### **Discord Integration**
- Discord Bot Token
- Discord Client ID  
- Discord Client Secret

### **Google OAuth (for user authentication)**
- Google Client ID
- Google Client Secret

### **Optional Services** 
- Epic Games Client ID & Secret
- Steam API Key
- Ballchasing API Token
- Chatwoot HMAC Key & Website Token

## 🚀 Two-Phase Deployment

### **Phase 1: Deploy DigitalOcean Infrastructure (Local Machine)**

Run from your local machine where you have this repository:

```bash
# Set your tokens
export DIGITALOCEAN_TOKEN="your_do_token"
export DOPPLER_TOKEN="your_doppler_token"

# Deploy the cloud infrastructure
./scripts/deploy-digitalocean-infrastructure.sh
```

This creates your droplets, load balancer, VPC, and networks (~10 minutes).

### **Phase 2: Deploy Applications (Remote Server)**

After Phase 1 completes:

```bash
# Copy application scripts to your server
MANAGER_IP=$(cd digitalocean-platform && pulumi stack output managerIp)
scp scripts/deploy-*.sh root@$MANAGER_IP:/root/

# Join workers to swarm
./scripts/join-swarm-workers.sh

# SSH and deploy applications
ssh root@$MANAGER_IP
cd /root && ./deploy-master.sh
```

**That's it!** The script will:

1. ✅ **Deploy all infrastructure** (Traefik, PostgreSQL, Redis, RabbitMQ, Minio)
2. ✅ **Configure SSL certificates** automatically
3. ✅ **Prompt for your credentials** when needed
4. ✅ **Deploy all applications** (Core API, Web, Discord Bot)
5. ✅ **Initialize the database** with migrations
6. ✅ **Set up object storage** buckets
7. ✅ **Verify everything** is working

## 📝 What the Script Will Ask You

### **Infrastructure Phase:**
- Your domain name (e.g., `sprocketbot.gg`)
- Your email address (for SSL certificates)

### **Application Phase:**
- Discord Bot Token
- Discord Client ID
- Discord Client Secret
- Google Client ID
- Google Client Secret
- Optional: Epic, Steam, Ballchasing, Chatwoot credentials

## ⏱️ Deployment Timeline

**Total time: ~15-20 minutes**

- Infrastructure deployment: ~8-10 minutes
- Application deployment: ~5-8 minutes
- SSL certificate generation: ~2-3 minutes

## 🎉 When Complete

Your platform will be live at:

- **Main Website**: `https://yourdomain.com`
- **API**: `https://api.yourdomain.com`
- **Admin Dashboard**: `https://traefik.yourdomain.com`
- **File Storage**: `https://minio-console.yourdomain.com`

## 🔧 Individual Scripts (Advanced)

If you need more control, you can run scripts individually:

### **Infrastructure Only:**
```bash
./deploy-infrastructure.sh
```
Deploys: Traefik, PostgreSQL, Redis, RabbitMQ, Minio

### **Applications Only:**
```bash
./deploy-applications.sh
```
Deploys: Core API, Web Frontend, Discord Bot
*(Requires infrastructure to be deployed first)*

## 🚨 Troubleshooting

### **Script Fails?**
```bash
# Check what's running
docker service ls

# Check logs
docker service logs SERVICE_NAME

# Common fixes:
docker system prune -f  # Clean up
docker service rm FAILED_SERVICE  # Remove failed service
# Then re-run the script
```

### **SSL Issues?**
- Ensure DNS is pointing to your server
- Wait 5-10 minutes for certificate generation
- Check: `docker service logs traefik_traefik`

### **Service Won't Start?**
```bash
# Check placement constraints
docker service ps SERVICE_NAME

# Check resource usage
docker stats

# Check secrets exist
docker secret ls
```

## 📊 Resource Usage

**Default deployment uses:**
- **CPU**: ~2-4 cores total
- **RAM**: ~6-8GB total
- **Storage**: ~250GB (PostgreSQL + Minio + logs)

## 🔒 Security Notes

The scripts automatically:
- Generate secure passwords for all services
- Store credentials in `/srv/infrastructure-passwords.txt`
- Configure SSL certificates for all endpoints
- Set up proper network isolation
- Use Docker secrets for sensitive data

**Keep these files secure:**
- `/srv/infrastructure-passwords.txt` - Database/service passwords
- `/srv/deployment-config.txt` - Application configuration

---

**🎉 That's it!** Your complete SprocketBot platform is deployed with one script. Professional-grade deployment made simple!
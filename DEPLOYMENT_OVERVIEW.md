Sprocket Infrastructure: Deployment Overview
===========================================

This guide explains what the scripts in this repo provision, their dependencies, and how to use them to bring up the platform with a managed PostgreSQL instance, two worker droplets, and persistent storage.

What Gets Provisioned
- VPC and Firewall: Isolated network with rules for Swarm and LB.
- Droplets: 1 manager + 2 workers (configurable), Docker preinstalled.
- Load Balancer: Routes 80/443 to swarm services (Traefik).
- Storage: Block volumes for Minio (100GB) and InfluxDB (50GB) attached to the manager.
- Managed Postgres: DigitalOcean Managed PostgreSQL cluster, reachable from droplets via VPC firewall rules.

Key Locations and Outputs
- Local outputs: `deployment-info.txt` (manager IP, LB IP, DB host/port/name/user).
- On manager:
  - `/srv/infrastructure-passwords.txt`: Redis/Rabbit/Minio passwords.
  - `/srv/managed-db.env`: DB host/port/name/user (no password).
  - Docker secret `postgres-password`: DB password used by services and migrations.

Dependencies
- Local machine: `pulumi`, `node`/`npm`, a DigitalOcean API token, a Doppler token, and an SSH public key.
- Manager droplet: Docker Swarm initialized by infra (script checks), internet egress.
- Optional: `doctl` to auto-upload SSH keys (script handles fallback).

Step-by-Step
1) Deploy DigitalOcean infrastructure (local)
   - Command: `scripts/deploy-digitalocean-infrastructure.sh`
   - Prompts for: region, droplet sizes, worker count, SSH key.
   - Provisions: VPC, LB, manager, workers, volumes, managed Postgres.
   - Outputs: manager/LB IPs, DB host/port/name/user (password kept as Pulumi secret).
   - Retrieve DB password if needed: from `digitalocean-platform/` run `pulumi stack output dbPassword --show-secrets`.

2) Bootstrap core infrastructure (on manager)
   - Copy scripts: `scp scripts/deploy-*.sh root@<MANAGER_IP>:/root/`
   - SSH: `ssh root@<MANAGER_IP>` and run `./deploy-infrastructure.sh`.
   - Prompts for: domain and email (Traefik TLS), then Managed Postgres details.
     - Tip: you can `echo` the DB values into `/root/deployment-info.txt` before running to prefill.
   - Creates: overlay networks (no in-swarm Postgres), Traefik + socket proxy, Redis, RabbitMQ, Minio, and secrets.
   - Stores: DB settings in `/srv/managed-db.env`, password in docker secret `postgres-password`.

3) Deploy applications (on manager)
   - Command: `./deploy-applications.sh`
   - Requires: Doppler project/config to fetch application secrets.
   - Uses: Managed Postgres via `/srv/managed-db.env` and `postgres-password` secret.
   - Deploys: Core API, Web frontend, Discord Bot. Runs DB migrations against managed Postgres.

Pulumi Configuration Keys (optional tuning)
- `digitalocean-platform:region` (default `nyc3`)
- `digitalocean-platform:manager-size` (default `s-4vcpu-8gb`)
- `digitalocean-platform:worker-size` (default `s-2vcpu-4gb`)
- `digitalocean-platform:worker-count` (default `2`)
- `digitalocean-platform:db-size` (default `db-s-1vcpu-1gb`)
- `digitalocean-platform:db-node-count` (default `1`)
- `digitalocean-platform:db-version` (default `14`)

Operational Notes
- Postgres is now managed; no `/mnt/postgres-data` volume or in-swarm DB is deployed.
- App DB password is mounted as `/run/secrets/postgres-password` in the Core app and migration container.
- Load balancer terminates at Traefik (TLS passthrough offload handled by Traefik with Let's Encrypt).

Verification Checklist
- After infra: `deployment-info.txt` exists locally; manager and LB IPs reachable; workers joined via `./scripts/join-swarm-workers-simple.sh`.
- On manager: `docker service ls` shows `socket-proxy`, `traefik`, `redis`, `rabbitmq`, `minio` services.
- After apps: `docker service ls` shows `core`, `web`, and `discord-bot`; Core logs indicate successful startup; migrations report success or up-to-date.

Troubleshooting
- DB connectivity: ensure `postgres-password` secret exists; verify `/srv/managed-db.env`; test with `psql -h $DB_HOST -U $DB_USER -d $DB_NAME`.
- TLS/Traefik: confirm DNS `A` records for `*.<domain>` point to the LB IP.
- Doppler: verify `DOPPLER_TOKEN` and selected project/config; ensure required secrets exist.


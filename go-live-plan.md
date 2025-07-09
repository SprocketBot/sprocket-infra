## Go-Live Plan for Sprocket Infrastructure

This document outlines the remaining steps required to go live with the new production instance of the Sprocket infrastructure. It assumes that the application services (located in `github.com/SprocketBot/Sprocket`) are already building and pushing Docker images to GitHub Container Registry (GHCR) correctly.

### 1. Cloud Provider Account Setup

*   Provision a new cloud provider account (e.g., AWS, GCP, Azure) dedicated to the production environment.
*   Configure necessary IAM roles/permissions within this account to allow Pulumi to deploy and manage resources.
*   Set up billing for the new cloud account.

### 2. Doppler Secrets Configuration

*   Manually update the placeholder values for all secrets in the Doppler `sprocket/infrastructure` project. This includes, but is not limited to, `GOOGLE_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `EPIC_CLIENT_ID`, `STEAM_API_KEY`, `BALLCHASING_API_TOKEN`, and `DISCORD_BOT_TOKEN`.

### 3. Pulumi Deployment Configuration (within `sprocket-infra` repository)

*   Review and update the production Pulumi stack file (e.g., `platform/Pulumi.main.yaml`) with:
    *   The correct cloud provider region for the production deployment.
    *   Any cloud-specific project IDs or configurations required for the new account.
    *   References to the appropriate GHCR image tags/versions for each service, ensuring they correspond to the production-ready builds from `github.com/SprocketBot/Sprocket`.
*   Run `pulumi up` for the production stack to deploy the infrastructure and services to the chosen cloud provider.

### 4. DNS Configuration

*   Configure DNS records to point to the deployed services. This typically involves setting up A/AAAA records for the Traefik ingress controller's external IP address or CNAME records if using a load balancer hostname.

### 5. Monitoring and Logging Verification

*   Verify that FluentD, Loki, Grafana, InfluxDB, and Telegraf are correctly configured and actively collecting logs and metrics from all deployed services in the production environment.
*   Set up essential dashboards and alerts in Grafana for continuous production monitoring.

### 6. Post-Deployment Testing

*   Perform comprehensive end-to-end testing of all deployed services in the production environment to ensure full functionality, stability, and performance under realistic conditions.

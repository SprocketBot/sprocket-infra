# Sprocket Platform Restoration
## Town Hall Presentation

---

## What Happened?

**The platform went down in early 2024 and stayed down for months.**

Your gaming platform - the one you all depend on for tournaments, stats, and community - was completely offline.

**Why did it take so long to fix?**

That's what we're here to talk about.

---

## The Situation: A Critical Infrastructure Crisis

### What We Lost
- Complete platform outage (web, API, Discord bot)
- All league play and scrim infrastructure
- Player stats and rankings
- Community features
- 22 different services offline

### The Reality
This exposed a fundamental weakness in our organization: we had no infrastructure team, no backup plans, and no clear ownership of critical systems.

---

## The Response Effort

### What It Took to Recover
**An emergency volunteer effort spanning 8 weeks of intensive work.**

- **56 days** of concentrated rebuilding
- **20+ major infrastructure commits** 
- **5 critical technical breakthroughs** solving systemic problems
- **Hundreds of hours** of volunteer time

### The Cost to the Organization
**Zero dollars** - but this highlights our first problem: we had no budget, no process, and no team structure for handling infrastructure crises.

---

## The Challenge: An Overly Complex System

### What Makes This System So Difficult?

The Sprocket platform isn't a simple website. It's a **22-service distributed system** with:

**Infrastructure Layer (Layer 1)**:
- Traefik reverse proxy with automatic HTTPS
- Vault secrets management with S3 backend
- Docker Socket Proxy for security

**Data Services Layer (Layer 2)**:
- PostgreSQL database (now managed externally)
- Redis caching
- RabbitMQ message queue
- InfluxDB time-series database
- Grafana monitoring
- Neo4j graph database
- N8n workflow automation
- Gatus service monitoring
- Loki log aggregation
- Telegraf metrics collection

**Application Layer (Platform)**:
- Web UI (Next.js)
- Backend API
- Discord bot integration
- Image generation service
- 6+ microservices

---

## Why So Complex?

### The Technical Reality

This isn't overengineering - **this is what it takes to run a modern gaming platform at scale.**

**You need**:
- Database for player data, match results, rankings
- Cache layer for fast page loads
- Message queues for Discord integration
- Time-series DB for performance metrics
- Graph DB for player/team relationships
- Workflow automation for tournaments
- Monitoring to know when things break
- Log aggregation to debug issues
- Metrics collection for performance

**Each piece exists for a reason.** Remove any one, and features break.

---

## The 5 Major Technical Challenges

### Challenge 1: Vault Unsealing Automation
**The Problem**: Vault (our secrets manager) requires manual unsealing after every restart. This created a chicken-and-egg problem with automation.

**The Battle**: 5 different approaches tried over 3 days before finding a solution.

**The Solution**: Custom auto-initialization script with local bind mount for unseal keys.

---

### Challenge 2: Database Reliability
**The Problem**: Self-hosted PostgreSQL in Docker with no backups, no HA, and data persistence concerns.

**The Decision**: Migrate to managed database service (Digital Ocean).

**The Impact**:
- Automated daily backups
- Point-in-time recovery
- Professional-grade reliability
- One less thing to manage

---

### Challenge 3: Storage Migration (MinIO → S3)
**The Problem**: Running our own S3-compatible storage (MinIO) was resource-intensive and unreliable.

**The Migration**: Phased approach over 8 days to move to AWS S3.

**The Benefit**: Professional-grade storage with 99.999999999% durability.

---

### Challenge 4: Multi-Environment Routing
**The Problem**: Platform needed to work in 4 different ways:
1. Local development (localhost)
2. LAN access (direct IP)
3. VPN access (Tailscale)
4. Public internet (real domain)

**The Complexity**: Different routing rules, certificates, and DNS for each pattern.

---

### Challenge 5: Secret Management Architecture
**The Problem**: Secrets scattered across multiple systems (Doppler, Vault, Pulumi, Docker).

**The Solution**: Hierarchical secret management:
- Doppler = Source of Truth
- Vault = Runtime Distribution
- Docker Secrets = Container Mounting
- Pulumi = Infrastructure Secrets

**The Reality**: Managing OAuth for Google, Discord, Epic, Steam + API tokens + database credentials + SMTP settings across 22 services.

---

## The 8-Week Journey

### Timeline of Recovery and Lessons Learned

**Week 1 (Sept 14-19)**: Foundation Rebuild
- Layer 1 infrastructure working again
- Rusty system brought back to life
- Vault initialization challenges begin

**Week 2 (Sept 19-23)**: The Vault Struggles
- 5 different attempts to automate Vault unsealing
- Each failure taught something new
- Breakthrough on Sept 19: "vault actually unseals!"

**Week 3-4 (Sept 30 - Oct 8)**: Storage Migration
- Phased migration from MinIO to AWS S3
- 8 days of careful data migration
- One less complex service to maintain

**Week 5 (Oct 26)**: Platform Resurrection
- After months offline: "Sprocket is alive!"
- All 22 services successfully deployed
- Web UI, API, Discord bot all responding

**Week 6 (Oct 26-27)**: Routing Hell
- Multi-environment routing problems
- IP-based vs hostname-based access
- Certificate management nightmares

**Week 7-8 (Nov 4-8)**: The Final Push
- Database migrated to managed service
- Production domain with Let's Encrypt
- Full HTTPS with automatic certificates
- **Nov 8: PRODUCTION COMPLETE**

---

## What Was Accomplished

### Production Infrastructure (Now Live)

**3-Layer Architecture**:
- Layer 1: Infrastructure (3 services)
- Layer 2: Data Services (9 services)
- Platform: Applications (10 services)

**External Services Integrated**:
- Digital Ocean Managed PostgreSQL
- AWS S3 / Digital Ocean Spaces storage
- Doppler secrets management
- Let's Encrypt certificates
- GitHub OAuth for access control

**Modern DevOps Practices**:
- Infrastructure as Code (Pulumi)
- Automated secret provisioning
- Service monitoring and alerting
- Log aggregation and metrics
- Automated HTTPS certificates
- Health checks and verification

---

## The Numbers

### Infrastructure Scale
- **22 services** deployed and running
- **5 Docker networks** for isolation
- **15+ persistent volumes** for data
- **20+ Vault secret paths** for credentials
- **6 external dependencies** integrated
- **~5,000 lines** of Infrastructure as Code

### Deployment Complexity
- **3 Pulumi stacks** (layer_1, layer_2, prod)
- **50+ configuration files** (JSON/YAML)
- **Multiple environments** (local, LAN, VPN, cloud)
- **4 different routing patterns** supported

### Development Effort
- **56 days** of work (Sept 14 - Nov 8)
- **20+ commits** in the rebuild phase
- **5 major breakthroughs**
- **Countless hours** debugging, testing, documenting

---

## The Real Problem: Organizational Failure

### What This Crisis Revealed

**This wasn't just a technical failure - it was an organizational one:**

1. **No Infrastructure Team**: We had nobody responsible for maintaining production systems
2. **No Knowledge Transfer**: Critical system knowledge lived in one person's head
3. **No Backup Plans**: When things broke, we had no procedures for recovery
4. **No Budget Allocation**: We weren't investing in the foundation that powers everything else
5. **No Succession Planning**: We assumed volunteers would always be available and willing

**The uncomfortable truth**: We got lucky. One person happened to have the skills and availability to fix this. Next time, we might not be so fortunate.

---

## The Complexity Problem

### Why Is This System So Hard to Work With?

**The Honest Truth**:

1. **Distributed Systems Are Hard**
   - 22 services that must work together
   - Complex networking and dependencies
   - Each service has its own quirks

2. **Security Is Hard**
   - Secret management across multiple systems
   - OAuth integration with 4 providers
   - Vault policies and access control
   - HTTPS certificates for multiple domains

3. **Multi-Environment Support Is Hard**
   - Local development vs production
   - Different routing for different access methods
   - Certificate management varies by environment

4. **DevOps Is Hard**
   - Infrastructure as Code requires deep knowledge
   - Docker Swarm orchestration is complex
   - Monitoring and debugging distributed systems
   - No simple "restart the server" solutions

---

## What We're Doing About Complexity

### The Over-Engineering Reality Check

**We need to be honest about how we got here.**

The current Sprocket platform was designed for a scale that never materialized:
- **Designed for**: 10s to 100s of thousands of users across dozens of organizations
- **Reality**: Much smaller scale, single organization focus
- **Cost**: Massive complexity overhead that made everything harder

**We paid a hefty price for this over-engineering:**
- 22 services to maintain instead of 5-6
- Complex multi-tenancy architecture that nobody needed
- Infrastructure complexity that required specialist knowledge
- Longer development cycles due to system complexity
- Higher barrier to entry for new volunteers

### The New Direction: Simplified by Design

**We're fundamentally changing our approach.**

**Old Model**: One master deployment for all organizations simultaneously
- Massive centralized infrastructure
- Complex multi-tenancy requirements
- Scale that never materialized
- One-size-fits-all architecture

**New Model**: One simplified deployment per organization
- Tailored infrastructure for actual needs
- Simple, focused architecture
- Each organization scales independently
- Vastly reduced complexity

### Sprocket v2: A Simpler Future

**The new platform direction eliminates the complexity that plagued us:**

**Infrastructure Simplification**:
- From 22+ services to ~6 core services
- Single-organization focus eliminates multi-tenancy overhead
- Standard deployment patterns that are easy to understand
- Reduced dependency on complex orchestration

**Code Simplification**:
- Remove unused scaling features
- Focus on actual user needs, not theoretical scale
- Simpler deployment and maintenance
- Lower barrier to entry for contributors

**Timeline**:
- **2025**: Continue stabilizing current platform while building v2
- **2026**: Early tests of Sprocket v2 with simplified architecture
- **Future**: Gradual migration to the new, sustainable model

### Active Simplification Efforts (Current Platform)

**We're working hard to make the current system easier while we build its replacement**:

1. **Better Documentation**
   - Comprehensive architecture docs
   - Step-by-step deployment guides
   - Troubleshooting runbooks
   - Postmortem with lessons learned

2. **Managed Services**
   - Moved database to managed PostgreSQL
   - Using cloud S3 instead of self-hosted
   - Let external experts handle infrastructure

3. **Automation**
   - Automated Vault unsealing
   - Scripted secret provisioning
   - Health check scripts
   - Deployment verification

4. **Reduction Where Possible**
   - Removed MinIO (one less service)
   - Consolidated configuration
   - Simplified routing where we can

**But**: Some complexity is unavoidable in the current system. This is why we're building Sprocket v2 - to eliminate this complexity at the architectural level.

---

## The Reality Check

### This Cannot Happen Again

**Relying on emergency volunteer efforts is not sustainable.**

**What happens if**:
- Our next crisis hits during a busy period?
- The people with knowledge aren't available?
- We face a problem nobody knows how to solve?
- Someone gets burned out from carrying too much?

**The answer**: We risk everything falling apart again, possibly for good.

---

## We Need Your Help

### Building a Sustainable Infrastructure Team

**We need to transition from crisis response to sustainable operations.**

**Specifically, we need people who can**:
- Help maintain infrastructure
- Debug production issues
- Improve documentation
- Assist with deployments
- Learn the system alongside us

**You don't need to be an expert.** You need to be:
- Willing to learn
- Able to commit some time
- Interested in keeping this community alive
- Not afraid of technical challenges

---

## What Help Looks Like

### Different Ways to Contribute

**Infrastructure & DevOps**:
- Learn Pulumi and Infrastructure as Code
- Help with deployments and updates
- Improve monitoring and alerting
- Optimize performance

**Documentation**:
- Improve technical docs
- Create video tutorials
- Write troubleshooting guides
- Document new features

**Testing & QA**:
- Test new deployments
- Verify service health
- Report issues clearly
- Help reproduce bugs

**On-Call Support**:
- Be available for production incidents
- Help debug urgent issues
- Coordinate with team on fixes

**Even Small Contributions Help**:
- Review PRs
- Update documentation
- Improve scripts
- Test changes locally

---

## The Skills You'd Learn

### Why Volunteer? Career Development.

**Working on this infrastructure teaches you**:

- **Infrastructure as Code** (Pulumi/Terraform)
- **Container Orchestration** (Docker Swarm/Kubernetes)
- **Secrets Management** (Vault, Doppler)
- **Reverse Proxy & Load Balancing** (Traefik)
- **Database Administration** (PostgreSQL, Redis, Neo4j)
- **Message Queues** (RabbitMQ)
- **Monitoring & Observability** (Grafana, Loki, Influx)
- **DevOps Best Practices**
- **Production System Debugging**
- **Distributed Systems Architecture**

**These are highly marketable skills** that companies pay six figures for.

---

## What Happens Next?

### The Path Forward

**Short Term (Next 3 Months)**:
1. Stabilize current production deployment
2. Set up proper monitoring and alerting
3. Create on-call rotation (need volunteers!)
4. Document common issues and solutions

**Medium Term (Next 6 Months)**:
1. Build our infrastructure team (ongoing effort)
2. Train new volunteers on the system
3. Improve automation and tooling
4. Reduce dependency on single individuals

**Long Term (Next Year)**:
1. Consider managed service alternatives
2. Evaluate if Kubernetes simplifies operations
3. Build a sustainable operations team
4. Ensure no single point of failure (human or technical)

---


---

## How to Get Involved

### Join the Infrastructure Team

**Contact Information**:
- Talk to us after this session
- Join #infrastructure channel on Discord
- Attend weekly infrastructure meetings
- Review docs and ask questions

**What We're Looking For**:
- Curiosity and willingness to learn
- Time commitment (even just a few hours/month helps)
- Interest in DevOps and infrastructure
- Team players who communicate well

**What You'll Get**:
- Valuable experience with production systems
- Mentorship from experienced engineers
- Resume-worthy projects
- The satisfaction of keeping this community alive

---

## Q&A: The Honest Answers

### Common Questions

**Q: Why is it so complicated?**
A: Modern gaming platforms require this architecture. We're running at scale with thousands of users.

**Q: Can't we just use a simpler solution?**
A: If you know of one that does everything we need, we're all ears. Simplification is ongoing, but some complexity is inherent.

**Q: Why did it take so long?**
A: Because we had no team, no process, and no budget for infrastructure. When everything broke, we had to start from scratch.

**Q: What happens if the people with knowledge leave?**
A: That's why we're building a team. No single person should be critical infrastructure.

**Q: How much time commitment are we talking about?**
A: Flexible. Even 2-4 hours a month helps. More is better, but something is better than nothing.

**Q: I don't know Docker/Kubernetes/Pulumi - can I still help?**
A: Yes! We need documentation, testing, and QA too. And we can teach you the technical stuff.

---

## The Bottom Line

### What You Need to Remember

1. **Your platform was dead.** We recovered it through an emergency volunteer effort that revealed serious organizational gaps.

2. **This system is complex** because running a modern gaming platform at scale IS complex. We're simplifying where we can.

3. **We need to build sustainable processes.** Volunteers are essential, but we need structure, not heroics.

4. **This is an opportunity** to learn valuable skills while helping your community build something that lasts.

5. **Without systemic changes**, we risk repeating this cycle when the next crisis hits.

---

## Thank You

### Recognition

**To the community**: Thank you for your patience during the outage.

**To everyone who contributed to the recovery**: Your effort bought us time to build something better.

**To those who will join us**: You're helping ensure this never happens again.

**Let's build sustainable infrastructure together.**

---

## Open Discussion

### Your Questions and Concerns

This is your platform. You deserve to understand:
- What happened
- Why our organization wasn't prepared
- What we're doing to fix the systemic issues
- How you can be part of the solution

**The floor is yours.**

Ask anything. Challenge assumptions. Voice concerns.

Let's talk.

---

## Resources and Links

### Where to Learn More

**Documentation** (comprehensive technical docs):
- Architecture guide
- Deployment guide
- Operations runbook
- Troubleshooting guide
- Postmortem with full timeline

**Code Repository**:
- GitHub: `sprocket-infra` (infrastructure code)
- All Infrastructure as Code is open to review

**Communication Channels**:
- Discord: #infrastructure
- Weekly meetings: [Time/Day TBD]
- GitHub Issues: For bug reports and features

**Getting Started**:
1. Read the documentation
2. Join #infrastructure channel
3. Attend a weekly meeting
4. Pick a starter task
5. Ask questions constantly

---

# Thank You

## Let's Keep This Community Alive - Together

**Questions? Comments? Want to volunteer?**

**Talk to us after this session or reach out on Discord.**

Your platform is back. Let's build the team to keep it that way.

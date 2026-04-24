# After Dark Systems MCP Infrastructure Expansion Plan
## Doubling Functionality: 60+ to 120+ Tools

**Document Version:** 1.0
**Date:** December 21, 2025
**Target:** Increase MCP capabilities by 100% and deploy across mcp.afterdarksys.com and mcp.n8nworkflo.ws

---

## Executive Summary

This document outlines the comprehensive strategy to double the After Dark Systems MCP infrastructure from 60+ tools to 120+ tools, integrating with the existing n8n Enterprise deployment on Oracle Cloud Infrastructure. The expansion focuses on cloud infrastructure management, database operations, payments, communications, and developer tools.

### Key Objectives
1. **Double Tool Count**: Expand from 60+ to 120+ MCP tools
2. **Multi-Domain Deployment**: Deploy via mcp.afterdarksys.com (primary) and mcp.n8nworkflo.ws (n8n-integrated)
3. **OCI Native**: Leverage existing Oracle Cloud infrastructure
4. **Tiered Access**: Integrate with n8n 4-tier subscription model (Free, Starter, Pro, Enterprise)
5. **Production Ready**: Enterprise-grade reliability, security, and observability

---

## Part 1: Architecture Design

### 1.1 Overall System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Oracle Cloud Infrastructure                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              OCI Load Balancer (Layer 7)                │   │
│  │  • SSL/TLS Termination                                  │   │
│  │  • Health Checks                                        │   │
│  │  • Rate Limiting                                        │   │
│  └──────────────┬─────────────────┬───────────────────────┘   │
│                 │                 │                             │
│      ┌──────────▼─────────┐  ┌───▼────────────────┐          │
│      │ mcp.afterdarksys.com│  │ mcp.n8nworkflo.ws  │          │
│      │  (Primary Gateway)   │  │  (n8n Integration) │          │
│      └──────────┬─────────┘  └───┬────────────────┘          │
│                 │                 │                             │
│  ┌──────────────▼─────────────────▼───────────────────────┐  │
│  │         MCP Gateway Service (Node.js/TypeScript)        │  │
│  │  • Request Routing                                      │  │
│  │  • Authentication (OAuth2 via Central Auth)             │  │
│  │  • Authorization (Tier-based access control)            │  │
│  │  • Metrics Collection                                   │  │
│  │  • Connection Pooling                                   │  │
│  └──────────────┬──────────────────────────────────────────┘  │
│                 │                                              │
│  ┌──────────────▼──────────────────────────────────────────┐  │
│  │          Module Router & Load Balancer                  │  │
│  └──────┬────────┬────────┬────────┬────────┬──────────────┘  │
│         │        │        │        │        │                  │
│  ┌──────▼──┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───────┐        │
│  │  Core   │ │ Cloud│ │  DB  │ │ Comm │ │Developer │        │
│  │ Modules │ │Module│ │Module│ │Module│ │ Module   │        │
│  │ (60)    │ │ (20) │ │ (15) │ │ (15) │ │  (10)    │        │
│  └─────────┘ └──────┘ └──────┘ └──────┘ └──────────┘        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 PostgreSQL 16 (RDS)                       │  │
│  │  • User subscriptions                                     │  │
│  │  • Tool usage metrics                                     │  │
│  │  • Session management                                     │  │
│  │  • Audit logs                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      Redis 7 Cache                        │  │
│  │  • Session storage                                        │  │
│  │  • Rate limit counters                                    │  │
│  │  • Tool response caching                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 MCP Gateway Service Architecture

**Technology Stack:**
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js 5.x with TypeScript
- **MCP SDK**: @modelcontextprotocol/sdk v1.19.1+
- **Transport**: HTTP/SSE (Server-Sent Events) + WebSocket
- **Authentication**: OAuth2/OIDC (integrated with After Dark Systems Central Auth)
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose (development) → Kubernetes (production optional)

**Key Components:**

```typescript
// Gateway Service Structure
src/
├── gateway/
│   ├── auth/
│   │   ├── oauth-client.ts       // Central Auth integration
│   │   ├── tier-validator.ts     // Subscription tier validation
│   │   └── jwt-validator.ts      // JWT token validation
│   ├── routing/
│   │   ├── module-router.ts      // Routes to appropriate module
│   │   ├── load-balancer.ts      // Load balancing across module instances
│   │   └── circuit-breaker.ts    // Fault tolerance
│   ├── middleware/
│   │   ├── rate-limiter.ts       // Tier-based rate limiting
│   │   ├── metrics.ts            // Prometheus metrics
│   │   ├── logging.ts            // Structured logging
│   │   └── error-handler.ts      // Centralized error handling
│   └── transports/
│       ├── http-transport.ts     // HTTP/REST transport
│       ├── sse-transport.ts      // Server-Sent Events
│       └── websocket-transport.ts // WebSocket transport
├── modules/
│   ├── core/                     // Existing 60 tools
│   ├── cloud/                    // New cloud infrastructure tools
│   ├── database/                 // New database tools
│   ├── communication/            // New communication tools
│   └── developer/                // New developer tools
├── shared/
│   ├── types/                    // TypeScript type definitions
│   ├── utils/                    // Shared utilities
│   └── config/                   // Configuration management
└── server.ts                     // Main entry point
```

### 1.3 Tier-Based Access Control

| Tier | Monthly Price | Tool Limit | Rate Limit | Features |
|------|--------------|------------|------------|----------|
| **Free** | $0 | 30 tools | 100 req/hour | Core filesystem, memory, basic terminal |
| **Starter** | $29 | 60 tools | 500 req/hour | + Basic cloud, PostgreSQL, Git |
| **Pro** | $99 | 100 tools | 2000 req/hour | + All cloud providers, advanced DB, payments, communications |
| **Enterprise** | $299 | All 120+ tools | Unlimited | + Priority support, custom modules, dedicated resources |

### 1.4 Horizontal Scaling Strategy

**Development Environment:**
- Single Docker Compose stack on OCI instance
- All modules in one unified server process
- PostgreSQL + Redis containers

**Production Environment:**
- Multiple gateway instances behind OCI Load Balancer
- Module-specific containers (can scale independently)
- Managed PostgreSQL (OCI Database Service)
- Managed Redis (OCI Cache with Redis)
- Auto-scaling based on:
  - CPU utilization (target: 70%)
  - Request queue depth
  - Response time (target: <200ms p95)

**Scaling Triggers:**
```yaml
# Auto-scaling configuration
scaling:
  gateway:
    min_instances: 2
    max_instances: 10
    cpu_threshold: 70
    memory_threshold: 80

  cloud_module:
    min_instances: 1
    max_instances: 5
    queue_depth: 50

  database_module:
    min_instances: 1
    max_instances: 3
    connection_pool_size: 20
```

---

## Part 2: MCP Server Recommendations (60 New Tools)

### 2.1 Cloud Infrastructure Module (20 tools)

#### Oracle Cloud Infrastructure (OCI) - 8 tools
**Source**: `github.com/jopsis/mcp-server-oci`
**Why**: Native OCI management for their existing infrastructure

**Tools:**
1. `oci_list_compute_instances` - List all compute instances in compartment
2. `oci_manage_instance_lifecycle` - Start/stop/restart/terminate instances
3. `oci_get_instance_metrics` - Get CPU, memory, network metrics
4. `oci_list_compartments` - List OCI compartments and resources
5. `oci_manage_block_volumes` - Create/attach/detach/delete block storage
6. `oci_list_database_systems` - List and manage database systems
7. `oci_get_vcn_details` - Virtual Cloud Network information
8. `oci_manage_load_balancers` - Load balancer configuration and status

**Integration Value**: Direct management of their existing n8n infrastructure

#### Cloudflare - 7 tools
**Source**: `github.com/cloudflare/mcp-server-cloudflare`
**Why**: DNS, Workers, KV, R2 for edge computing and storage

**Tools:**
9. `cloudflare_manage_dns_records` - Create/update/delete DNS records
10. `cloudflare_deploy_worker` - Deploy Cloudflare Worker scripts
11. `cloudflare_manage_kv_namespace` - KV store operations
12. `cloudflare_manage_r2_bucket` - R2 object storage operations
13. `cloudflare_purge_cache` - Cache invalidation
14. `cloudflare_get_analytics` - DNS and Worker analytics
15. `cloudflare_manage_waf_rules` - WAF rule management

**Integration Value**: Edge computing for MCP endpoints, DNS management for domains

#### Docker - 5 tools
**Source**: `github.com/QuantGeekDev/docker-mcp`
**Why**: Container management for their Docker-based infrastructure

**Tools:**
16. `docker_list_containers` - List all containers
17. `docker_manage_container` - Start/stop/restart containers
18. `docker_compose_stack` - Deploy/manage compose stacks
19. `docker_get_logs` - Retrieve container logs
20. `docker_manage_volumes` - Volume management

**Integration Value**: Manage their n8n Docker stack programmatically

### 2.2 Database Module (15 tools)

#### Neon Serverless PostgreSQL - 6 tools
**Source**: `github.com/neondatabase/mcp-server-neon`
**Why**: Serverless Postgres with branching, perfect for development

**Tools:**
21. `neon_create_project` - Create new database project
22. `neon_create_branch` - Create database branch (for testing)
23. `neon_execute_query` - Run SQL queries
24. `neon_get_connection_string` - Get connection details
25. `neon_manage_compute` - Scale compute resources
26. `neon_get_metrics` - Database performance metrics

**Integration Value**: Rapid database provisioning for n8n workflow testing

#### PostgreSQL MCP - 5 tools
**Source**: `github.com/benborla/mcp-server-postgres` or official Anthropic server
**Why**: Direct PostgreSQL management for existing n8n database

**Tools:**
27. `postgres_execute_query` - Execute SQL queries
28. `postgres_list_tables` - List database tables
29. `postgres_describe_schema` - Get table schema details
30. `postgres_analyze_query` - Query performance analysis
31. `postgres_manage_connections` - Connection pool management

**Integration Value**: Direct management of n8n's PostgreSQL 16 database

#### Redis Cache - 4 tools
**Source**: Custom implementation or `github.com/Tomatio13/mcp-server-redis`
**Why**: Manage Redis 7 cache used by n8n

**Tools:**
32. `redis_get_key` - Retrieve cached values
33. `redis_set_key` - Set cache values
34. `redis_list_keys` - List keys by pattern
35. `redis_get_stats` - Cache hit/miss statistics

**Integration Value**: Cache management and debugging for n8n workflows

### 2.3 Communication Module (15 tools)

#### Twilio - 6 tools
**Source**: `github.com/YiyangLi/sms-mcp-server`
**Why**: SMS/Voice for notifications and telephony integration

**Tools:**
36. `twilio_send_sms` - Send SMS messages
37. `twilio_send_mms` - Send MMS with media
38. `twilio_make_call` - Initiate voice call
39. `twilio_list_messages` - List sent/received messages
40. `twilio_get_call_logs` - Call history and recordings
41. `twilio_manage_phone_numbers` - Purchase/configure phone numbers

**Integration Value**: Communication capabilities for n8n workflows

#### Slack - 5 tools
**Source**: `github.com/modelcontextprotocol/servers/slack` (official)
**Why**: Team communication and notifications

**Tools:**
42. `slack_send_message` - Send message to channel/user
43. `slack_list_channels` - List workspace channels
44. `slack_upload_file` - Upload files to Slack
45. `slack_get_thread` - Retrieve thread messages
46. `slack_manage_reactions` - Add/remove emoji reactions

**Integration Value**: Team notifications for workflow events

#### Email (SMTP/IMAP) - 4 tools
**Source**: Custom implementation
**Why**: Email integration for workflows

**Tools:**
47. `email_send` - Send email via SMTP
48. `email_list_inbox` - List inbox messages
49. `email_read_message` - Read email content
50. `email_search` - Search emails by criteria

**Integration Value**: Email automation in n8n workflows

### 2.4 Developer Tools Module (10 tools)

#### GitHub - 4 tools
**Source**: `github.com/modelcontextprotocol/servers/github` (official)
**Why**: Version control and CI/CD integration

**Tools:**
51. `github_create_pr` - Create pull request
52. `github_manage_issues` - Create/update issues
53. `github_get_repo_info` - Repository information
54. `github_manage_actions` - GitHub Actions workflows

**Integration Value**: Automate development workflow

#### GitLab - 3 tools
**Source**: Official GitLab MCP server
**Why**: Alternative version control platform

**Tools:**
55. `gitlab_create_merge_request` - Create MR
56. `gitlab_manage_pipelines` - CI/CD pipeline management
57. `gitlab_get_project_info` - Project details

**Integration Value**: Support for GitLab users

#### Stripe - 3 tools
**Source**: `github.com/stripe/agent-toolkit` (official)
**Why**: Payment processing for subscriptions

**Tools:**
58. `stripe_create_customer` - Create customer
59. `stripe_create_subscription` - Manage subscriptions
60. `stripe_process_payment` - Process one-time payments

**Integration Value**: Payment automation for tier upgrades

---

## Part 3: DNS/Routing Design

### 3.1 DNS Configuration

**Primary Domain: mcp.afterdarksys.com**
```
Type: A Record
Host: mcp.afterdarksys.com
Points to: OCI Load Balancer IP (e.g., 129.146.x.x)
TTL: 300 (5 minutes for quick failover)

Purpose: Primary MCP gateway for all After Dark Systems services
```

**n8n Integration Domain: mcp.n8nworkflo.ws**
```
Type: A Record
Host: mcp.n8nworkflo.ws
Points to: Same OCI Load Balancer IP
TTL: 300

Purpose: n8n-specific MCP endpoint with workflow-optimized routing
```

### 3.2 OCI Load Balancer Configuration

```yaml
# OCI Load Balancer Configuration
load_balancer:
  shape: "flexible"  # 10 Mbps min, 100 Mbps max

  listeners:
    - name: "mcp-https-afterdarksys"
      port: 443
      protocol: "HTTPS"
      hostname: "mcp.afterdarksys.com"
      ssl_certificate: "letsencrypt-afterdarksys"
      backend_set: "mcp-gateway-pool"

    - name: "mcp-https-n8n"
      port: 443
      protocol: "HTTPS"
      hostname: "mcp.n8nworkflo.ws"
      ssl_certificate: "letsencrypt-n8nworkflo"
      backend_set: "mcp-gateway-pool"

  backend_sets:
    mcp-gateway-pool:
      policy: "LEAST_CONNECTIONS"
      health_check:
        protocol: "HTTP"
        port: 3000
        url_path: "/health"
        interval_ms: 10000
        timeout_ms: 3000
        retries: 3

      backends:
        - ip: "10.0.1.10"  # Gateway instance 1
          port: 3000
          weight: 1
        - ip: "10.0.1.11"  # Gateway instance 2
          port: 3000
          weight: 1

  ssl_configuration:
    cipher_suite_name: "oci-modern-ssl-cipher-suite-v1"
    protocols: ["TLSv1.2", "TLSv1.3"]
```

### 3.3 Routing Logic

**Request Flow:**

1. **DNS Resolution**: Client resolves mcp.afterdarksys.com or mcp.n8nworkflo.ws to Load Balancer IP
2. **SSL Termination**: Load Balancer terminates SSL
3. **Host-Based Routing**: Routes to appropriate backend based on Host header
4. **Gateway Authentication**: OAuth2 token validation via Central Auth
5. **Tier Validation**: Check user's subscription tier
6. **Module Routing**: Route to appropriate module based on tool name
7. **Response**: Stream response back through gateway

**Routing Rules:**

```typescript
// Gateway routing logic
interface RoutingRule {
  domain: string;
  defaultModules?: string[];
  rateLimit?: number;
  priority?: number;
}

const routingRules: RoutingRule[] = [
  {
    domain: "mcp.n8nworkflo.ws",
    defaultModules: ["n8n-integration", "webhook", "workflow"],
    rateLimit: 1000, // Higher limit for n8n workflows
    priority: 1
  },
  {
    domain: "mcp.afterdarksys.com",
    defaultModules: ["all"],
    rateLimit: 500,
    priority: 2
  }
];
```

### 3.4 Failover Strategy

**Active-Active Configuration:**
- Both domains point to same load balancer
- Multiple gateway instances for redundancy
- Health checks every 10 seconds
- Automatic removal of unhealthy backends

**Disaster Recovery:**
- Database: PostgreSQL with point-in-time recovery
- Configuration: Stored in Git, deployed via IaC
- RPO (Recovery Point Objective): 5 minutes
- RTO (Recovery Time Objective): 15 minutes

---

## Part 4: Integration with n8n

### 4.1 n8n MCP Client Node

n8n already has built-in MCP support via the **MCP Client Tool** node. The integration leverages this existing functionality.

**Connection Configuration:**

```typescript
// n8n MCP Client configuration for mcp.n8nworkflo.ws
{
  "connectionType": "http-streamable",
  "endpoint": "https://mcp.n8nworkflo.ws/mcp",
  "authentication": {
    "type": "oauth2",
    "authUrl": "https://auth.afterdarksys.com/oauth/authorize",
    "tokenUrl": "https://auth.afterdarksys.com/oauth/token",
    "clientId": "n8n-mcp-client",
    "scopes": ["mcp.read", "mcp.write", "mcp.execute"]
  }
}
```

### 4.2 n8n Workflow Templates

**Template 1: Database Provisioning**
```
Trigger: Manual/Webhook
→ MCP Client: neon_create_project
→ MCP Client: neon_create_branch (dev)
→ MCP Client: postgres_execute_query (schema creation)
→ Slack: Send notification
```

**Template 2: Cloud Infrastructure Monitoring**
```
Trigger: Schedule (every 5 minutes)
→ MCP Client: oci_get_instance_metrics
→ If: CPU > 80%
  → MCP Client: slack_send_message (alert)
  → MCP Client: oci_manage_instance_lifecycle (scale up)
```

**Template 3: Payment Processing**
```
Trigger: Webhook (user upgrade)
→ MCP Client: stripe_create_customer
→ MCP Client: stripe_create_subscription
→ MCP Client: postgres_execute_query (update user tier)
→ MCP Client: email_send (confirmation)
```

### 4.3 Tool Discovery Mechanism

The MCP gateway exposes a discovery endpoint for n8n:

```typescript
// Tool discovery endpoint
app.get('/mcp/tools', authenticateOAuth, async (req, res) => {
  const userTier = await getUserTier(req.user.id);
  const availableTools = filterToolsByTier(allTools, userTier);

  res.json({
    tools: availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      module: tool.module,
      tier: tool.requiredTier
    })),
    userTier: userTier,
    rateLimit: getRateLimitForTier(userTier)
  });
});
```

### 4.4 n8n-Specific Optimizations

**Workflow Context Passing:**
```typescript
// Enhanced context for n8n workflows
interface N8nContext {
  workflowId: string;
  executionId: string;
  nodeId: string;
  userId: string;
  tier: SubscriptionTier;
}

// Gateway recognizes n8n requests and provides workflow tracking
app.post('/mcp/execute', async (req, res) => {
  const context = extractN8nContext(req.headers);

  // Store workflow execution metrics
  await metrics.recordWorkflowExecution({
    workflowId: context.workflowId,
    toolName: req.body.toolName,
    userId: context.userId,
    tier: context.tier,
    timestamp: Date.now()
  });

  // Execute tool with enhanced logging
  const result = await executeTool(req.body.toolName, req.body.params, context);
  res.json(result);
});
```

**Batch Operations Support:**
```typescript
// Allow n8n to batch multiple tool calls in one request
app.post('/mcp/batch', async (req, res) => {
  const { operations } = req.body;

  const results = await Promise.all(
    operations.map(op => executeTool(op.tool, op.params))
  );

  res.json({ results });
});
```

---

## Part 5: Deployment Strategy

### 5.1 Infrastructure Setup (Week 1)

**Step 1: Prepare OCI Environment**

```bash
# 1. Create OCI compartment for MCP services
oci iam compartment create \
  --name "mcp-services" \
  --description "MCP Gateway and related services"

# 2. Create VCN (Virtual Cloud Network)
oci network vcn create \
  --compartment-id $COMPARTMENT_ID \
  --cidr-block "10.0.0.0/16" \
  --display-name "mcp-vcn"

# 3. Create public subnet for load balancer
oci network subnet create \
  --compartment-id $COMPARTMENT_ID \
  --vcn-id $VCN_ID \
  --cidr-block "10.0.1.0/24" \
  --display-name "mcp-public-subnet"

# 4. Create private subnet for compute instances
oci network subnet create \
  --compartment-id $COMPARTMENT_ID \
  --vcn-id $VCN_ID \
  --cidr-block "10.0.2.0/24" \
  --display-name "mcp-private-subnet"

# 5. Create Internet Gateway
oci network internet-gateway create \
  --compartment-id $COMPARTMENT_ID \
  --vcn-id $VCN_ID \
  --is-enabled true \
  --display-name "mcp-igw"

# 6. Create security lists
# Allow HTTPS (443) and HTTP (80) inbound
# Allow all outbound
```

**Step 2: Provision Database Services**

```bash
# Option A: OCI Database Service (PostgreSQL)
oci db system launch \
  --compartment-id $COMPARTMENT_ID \
  --db-version "16.0" \
  --db-name "mcpdb" \
  --admin-password $STRONG_PASSWORD \
  --cpu-core-count 2 \
  --db-storage-size-in-gbs 256

# Option B: Use existing n8n PostgreSQL (shared database)
# Create separate schema for MCP services
psql -h n8nworkflo.ws -U postgres -c "CREATE SCHEMA mcp_gateway;"
```

**Step 3: Setup Redis Cache**

```bash
# Option A: OCI Cache with Redis
oci redis cluster create \
  --compartment-id $COMPARTMENT_ID \
  --display-name "mcp-cache" \
  --node-count 2 \
  --software-version "7.0"

# Option B: Docker container on existing instance
docker run -d \
  --name mcp-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  -v /data/redis:/data \
  redis:7-alpine redis-server --appendonly yes
```

### 5.2 Application Deployment (Week 2)

**Step 1: Build MCP Gateway Docker Image**

```dockerfile
# /Users/ryan/development/afterdark-mcp-builder/Dockerfile.gateway

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup -g 1001 -S mcpuser && \
    adduser -S mcpuser -u 1001

USER mcpuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "dist/server.js"]
```

**Step 2: Docker Compose Configuration**

```yaml
# /Users/ryan/development/afterdark-mcp-builder/docker-compose.mcp.yml

version: '3.8'

services:
  mcp-gateway:
    build:
      context: .
      dockerfile: Dockerfile.gateway
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://user:pass@postgres:5432/mcpdb
      - REDIS_URL=redis://redis:6379
      - OAUTH_ISSUER=https://auth.afterdarksys.com
      - OAUTH_CLIENT_ID=${OAUTH_CLIENT_ID}
      - OAUTH_CLIENT_SECRET=${OAUTH_CLIENT_SECRET}
      - LOG_LEVEL=info
    depends_on:
      - postgres
      - redis
    networks:
      - mcp-network
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  mcp-core-module:
    build:
      context: ./unified-mcp-server
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - MODULE_TYPE=core
    networks:
      - mcp-network
    deploy:
      replicas: 2

  mcp-cloud-module:
    build:
      context: ./modules/cloud
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - MODULE_TYPE=cloud
      - OCI_CONFIG_FILE=/config/oci_config
    volumes:
      - ./config/oci:/config:ro
    networks:
      - mcp-network

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=mcpdb
      - POSTGRES_USER=mcpuser
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - mcp-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mcpuser"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - mcp-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    networks:
      - mcp-network

  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
      - ./config/grafana/dashboards:/etc/grafana/provisioning/dashboards
    networks:
      - mcp-network

volumes:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:

networks:
  mcp-network:
    driver: bridge
```

**Step 3: Deploy to OCI Instance**

```bash
#!/bin/bash
# deploy-mcp.sh

set -e

echo "Deploying MCP Gateway to OCI..."

# 1. SSH to OCI instance
ssh opc@n8nworkflo.ws << 'ENDSSH'

# 2. Clone repository
cd /opt
sudo git clone https://github.com/afterdarksystems/afterdark-mcp-builder.git
cd afterdark-mcp-builder

# 3. Create environment file
sudo tee .env.production > /dev/null <<EOF
OAUTH_CLIENT_ID=mcp-gateway-prod
OAUTH_CLIENT_SECRET=your-secret-here
POSTGRES_PASSWORD=strong-password-here
GRAFANA_PASSWORD=grafana-admin-password
DATABASE_URL=postgresql://mcpuser:strong-password-here@postgres:5432/mcpdb
REDIS_URL=redis://redis:6379
EOF

# 4. Build and start services
sudo docker-compose -f docker-compose.mcp.yml build
sudo docker-compose -f docker-compose.mcp.yml up -d

# 5. Verify deployment
sleep 30
curl -f http://localhost:3000/health || exit 1

echo "MCP Gateway deployed successfully!"

ENDSSH
```

### 5.3 Load Balancer Configuration (Week 2)

**Step 1: Create OCI Load Balancer**

```bash
# Create load balancer
oci lb load-balancer create \
  --compartment-id $COMPARTMENT_ID \
  --display-name "mcp-lb" \
  --shape-name "flexible" \
  --subnet-ids '["'$PUBLIC_SUBNET_ID'"]' \
  --is-private false \
  --shape-details '{"minimumBandwidthInMbps": 10, "maximumBandwidthInMbps": 100}'

# Wait for load balancer creation
LB_ID=$(oci lb load-balancer list --compartment-id $COMPARTMENT_ID --query 'data[0].id' --raw-output)

# Create backend set
oci lb backend-set create \
  --load-balancer-id $LB_ID \
  --name "mcp-gateway-backend" \
  --policy "LEAST_CONNECTIONS" \
  --health-checker-protocol "HTTP" \
  --health-checker-port 3000 \
  --health-checker-url-path "/health"

# Add backends (gateway instances)
oci lb backend create \
  --load-balancer-id $LB_ID \
  --backend-set-name "mcp-gateway-backend" \
  --ip-address "10.0.2.10" \
  --port 3000

# Create SSL certificate
oci lb certificate create \
  --load-balancer-id $LB_ID \
  --certificate-name "mcp-afterdarksys-cert" \
  --ca-certificate-file ca-cert.pem \
  --private-key-file private-key.pem \
  --public-certificate-file cert.pem

# Create HTTPS listener
oci lb listener create \
  --load-balancer-id $LB_ID \
  --name "mcp-https-listener" \
  --default-backend-set-name "mcp-gateway-backend" \
  --port 443 \
  --protocol "HTTP" \
  --ssl-certificate-name "mcp-afterdarksys-cert"
```

**Step 2: Configure DNS**

```bash
# Get load balancer public IP
LB_IP=$(oci lb load-balancer get --load-balancer-id $LB_ID --query 'data."ip-addresses"[0]."ip-address"' --raw-output)

echo "Configure DNS records:"
echo "mcp.afterdarksys.com A $LB_IP"
echo "mcp.n8nworkflo.ws A $LB_IP"

# If using Cloudflare:
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "mcp.afterdarksys.com",
    "content": "'$LB_IP'",
    "ttl": 300,
    "proxied": false
  }'

curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "type": "A",
    "name": "mcp.n8nworkflo.ws",
    "content": "'$LB_IP'",
    "ttl": 300,
    "proxied": false
  }'
```

### 5.4 SSL/TLS Configuration (Week 2)

```bash
# Install certbot on OCI instance
sudo yum install -y certbot

# Generate Let's Encrypt certificates
sudo certbot certonly --standalone \
  -d mcp.afterdarksys.com \
  -d mcp.n8nworkflo.ws \
  --email admin@afterdarksys.com \
  --agree-tos \
  --non-interactive

# Upload to OCI Load Balancer
oci lb certificate create \
  --load-balancer-id $LB_ID \
  --certificate-name "letsencrypt-wildcard" \
  --ca-certificate-file /etc/letsencrypt/live/mcp.afterdarksys.com/chain.pem \
  --private-key-file /etc/letsencrypt/live/mcp.afterdarksys.com/privkey.pem \
  --public-certificate-file /etc/letsencrypt/live/mcp.afterdarksys.com/cert.pem

# Setup auto-renewal
sudo crontab -e
# Add: 0 0 1 * * certbot renew --quiet && /path/to/upload-certs.sh
```

### 5.5 Module Integration (Week 3-4)

**Week 3: Cloud & Database Modules**

```bash
# 1. Clone and integrate OCI MCP server
cd /opt/afterdark-mcp-builder/modules
git clone https://github.com/jopsis/mcp-server-oci.git cloud/oci
cd cloud/oci && npm install && npm run build

# 2. Clone and integrate Cloudflare MCP server
git clone https://github.com/cloudflare/mcp-server-cloudflare.git cloud/cloudflare
cd cloud/cloudflare && npm install && npm run build

# 3. Clone and integrate Docker MCP server
git clone https://github.com/QuantGeekDev/docker-mcp.git cloud/docker
cd cloud/docker && pip install -r requirements.txt

# 4. Clone and integrate Neon MCP server
git clone https://github.com/neondatabase/mcp-server-neon.git database/neon
cd database/neon && npm install && npm run build

# 5. Setup PostgreSQL MCP (custom implementation)
# Create wrapper for existing n8n PostgreSQL connection

# 6. Update gateway router to include new modules
```

**Week 4: Communication & Developer Modules**

```bash
# 1. Twilio MCP server
git clone https://github.com/YiyangLi/sms-mcp-server.git communication/twilio
cd communication/twilio && npm install && npm run build

# 2. Slack MCP server (official)
npx @modelcontextprotocol/create-server communication/slack

# 3. GitHub MCP server (official)
npx @modelcontextprotocol/create-server developer/github

# 4. GitLab MCP server
git clone https://gitlab.com/gitlab-org/mcp-server-gitlab.git developer/gitlab
cd developer/gitlab && npm install && npm run build

# 5. Stripe MCP server
npm install @stripe/agent-toolkit
# Implement wrapper in developer/stripe/
```

### 5.6 Testing & Validation (Week 4)

**Automated Test Suite:**

```typescript
// test/integration/gateway.test.ts

import { MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { describe, it, expect } from '@jest/globals';

describe('MCP Gateway Integration Tests', () => {
  const client = new MCPClient({
    endpoint: 'https://mcp.afterdarksys.com/mcp',
    auth: {
      type: 'oauth2',
      token: process.env.TEST_TOKEN
    }
  });

  it('should list all available tools', async () => {
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(120);
  });

  it('should respect tier-based access', async () => {
    // Test Free tier (30 tools)
    const freeTools = await client.listTools({ tier: 'free' });
    expect(freeTools.length).toBe(30);

    // Test Enterprise tier (all tools)
    const enterpriseTools = await client.listTools({ tier: 'enterprise' });
    expect(enterpriseTools.length).toBeGreaterThanOrEqual(120);
  });

  it('should execute OCI tool', async () => {
    const result = await client.callTool({
      name: 'oci_list_compute_instances',
      arguments: { compartmentId: 'ocid1.compartment...' }
    });
    expect(result).toHaveProperty('instances');
  });

  it('should execute Cloudflare DNS tool', async () => {
    const result = await client.callTool({
      name: 'cloudflare_manage_dns_records',
      arguments: {
        action: 'list',
        zoneId: process.env.CF_ZONE_ID
      }
    });
    expect(result).toHaveProperty('records');
  });

  it('should execute Neon database tool', async () => {
    const result = await client.callTool({
      name: 'neon_create_branch',
      arguments: {
        projectId: 'test-project',
        branchName: 'test-branch'
      }
    });
    expect(result).toHaveProperty('branchId');
  });

  it('should enforce rate limits', async () => {
    const promises = Array(200).fill(null).map(() =>
      client.callTool({ name: 'test_tool', arguments: {} })
    );

    await expect(Promise.all(promises)).rejects.toThrow('Rate limit exceeded');
  });
});
```

**Load Testing:**

```bash
# Use k6 for load testing
cat > load-test.js <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200
    { duration: '5m', target: 200 },  // Stay at 200
    { duration: '2m', target: 0 },    // Ramp down
  ],
};

export default function () {
  let payload = JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/list',
    id: 1
  });

  let params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + __ENV.TEST_TOKEN
    },
  };

  let res = http.post('https://mcp.afterdarksys.com/mcp', payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
EOF

k6 run load-test.js
```

### 5.7 Monitoring & Observability (Week 4)

**Prometheus Configuration:**

```yaml
# config/prometheus.yml

global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'mcp-gateway'
    static_configs:
      - targets: ['mcp-gateway:3000']
    metrics_path: '/metrics'

  - job_name: 'mcp-modules'
    static_configs:
      - targets:
        - 'mcp-core-module:3000'
        - 'mcp-cloud-module:3000'
        - 'mcp-database-module:3000'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
```

**Grafana Dashboard Configuration:**

```json
{
  "dashboard": {
    "title": "MCP Gateway Metrics",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(mcp_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(mcp_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(mcp_errors_total[5m])"
          }
        ]
      },
      {
        "title": "Active Users by Tier",
        "targets": [
          {
            "expr": "mcp_active_users_by_tier"
          }
        ]
      },
      {
        "title": "Tool Usage Heatmap",
        "targets": [
          {
            "expr": "sum(rate(mcp_tool_calls_total[5m])) by (tool_name)"
          }
        ]
      }
    ]
  }
}
```

**Alerting Rules:**

```yaml
# config/alerts.yml

groups:
  - name: mcp_gateway
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(mcp_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors/sec"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(mcp_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "95th percentile response time is {{ $value }}s"

      - alert: GatewayDown
        expr: up{job="mcp-gateway"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MCP Gateway is down"
          description: "Gateway instance {{ $labels.instance }} is unreachable"

      - alert: DatabaseConnectionPoolExhausted
        expr: mcp_db_connections_active / mcp_db_connections_max > 0.9
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool almost exhausted"
```

---

## Part 6: Tool Catalog Summary

### Complete 120+ Tool Inventory

#### Core Module (60 existing tools)
**File Operations (11):**
1. read_file
2. write_file
3. edit_file
4. create_directory
5. list_directory
6. delete_file
7. move_file
8. search_files
9. get_file_info
10. directory_tree
11. search_content

**Memory Management (9):**
12. create_entities
13. update_entities
14. delete_entities
15. list_entities
16. search_entities
17. create_relation
18. update_relation
19. delete_relation
20. search_relations

**Terminal Control (15):**
21. execute_command
22. execute_script
23. get_process_list
24. kill_process
25. get_environment_vars
26. set_environment_var
27. start_background_process
28. get_process_output
29. stop_background_process
30. execute_with_timeout
31. get_system_info
32. monitor_resources
33. schedule_task
34. list_scheduled_tasks
35. cancel_scheduled_task

**Browser Automation (25):**
36. launch_browser
37. navigate_to_url
38. click_element
39. type_text
40. get_page_content
41. take_screenshot
42. execute_javascript
43. wait_for_element
44. scroll_page
45. get_cookies
46. set_cookie
47. clear_cookies
48. get_local_storage
49. set_local_storage
50. submit_form
51. upload_file
52. download_file
53. get_page_title
54. get_current_url
55. go_back
56. go_forward
57. refresh_page
58. close_tab
59. switch_tab
60. get_element_attribute

#### Cloud Infrastructure Module (20 new tools)

**OCI Management (8):**
61. oci_list_compute_instances
62. oci_manage_instance_lifecycle
63. oci_get_instance_metrics
64. oci_list_compartments
65. oci_manage_block_volumes
66. oci_list_database_systems
67. oci_get_vcn_details
68. oci_manage_load_balancers

**Cloudflare (7):**
69. cloudflare_manage_dns_records
70. cloudflare_deploy_worker
71. cloudflare_manage_kv_namespace
72. cloudflare_manage_r2_bucket
73. cloudflare_purge_cache
74. cloudflare_get_analytics
75. cloudflare_manage_waf_rules

**Docker (5):**
76. docker_list_containers
77. docker_manage_container
78. docker_compose_stack
79. docker_get_logs
80. docker_manage_volumes

#### Database Module (15 new tools)

**Neon (6):**
81. neon_create_project
82. neon_create_branch
83. neon_execute_query
84. neon_get_connection_string
85. neon_manage_compute
86. neon_get_metrics

**PostgreSQL (5):**
87. postgres_execute_query
88. postgres_list_tables
89. postgres_describe_schema
90. postgres_analyze_query
91. postgres_manage_connections

**Redis (4):**
92. redis_get_key
93. redis_set_key
94. redis_list_keys
95. redis_get_stats

#### Communication Module (15 new tools)

**Twilio (6):**
96. twilio_send_sms
97. twilio_send_mms
98. twilio_make_call
99. twilio_list_messages
100. twilio_get_call_logs
101. twilio_manage_phone_numbers

**Slack (5):**
102. slack_send_message
103. slack_list_channels
104. slack_upload_file
105. slack_get_thread
106. slack_manage_reactions

**Email (4):**
107. email_send
108. email_list_inbox
109. email_read_message
110. email_search

#### Developer Tools Module (10 new tools)

**GitHub (4):**
111. github_create_pr
112. github_manage_issues
113. github_get_repo_info
114. github_manage_actions

**GitLab (3):**
115. gitlab_create_merge_request
116. gitlab_manage_pipelines
117. gitlab_get_project_info

**Stripe (3):**
118. stripe_create_customer
119. stripe_create_subscription
120. stripe_process_payment

---

## Part 7: Success Metrics & KPIs

### Quantifiable Goals

**Functionality Metrics:**
- Current: 60 tools across 5 modules
- Target: 120+ tools across 10 modules
- Achievement: 100% increase in capabilities

**Performance Metrics:**
- Request latency (p95): < 500ms
- Gateway uptime: 99.9% (43 minutes downtime/month)
- Concurrent users: 1,000+
- Requests per second: 500+

**Business Metrics:**
- Free tier adoption: 1,000+ users in first quarter
- Paid conversion rate: 10% (100 paid users)
- Average revenue per user (ARPU): $75/month
- First-year revenue target: $90,000

**Usage Metrics:**
- Most used tools: Track top 20
- Module utilization: >50% of tools in each module used monthly
- n8n workflow templates: 20+ published templates
- API uptime: 99.95%

---

## Part 8: Risk Assessment & Mitigation

### Technical Risks

**Risk 1: Integration Complexity**
- **Probability**: High
- **Impact**: Medium
- **Mitigation**:
  - Modular architecture allows independent module deployment
  - Comprehensive testing suite for each module
  - Fallback to existing tools if new modules fail

**Risk 2: Performance Degradation**
- **Probability**: Medium
- **Impact**: High
- **Mitigation**:
  - Load balancing across multiple instances
  - Caching layer (Redis) for frequently accessed data
  - Circuit breakers to prevent cascade failures
  - Performance monitoring with automatic scaling

**Risk 3: Third-Party API Changes**
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**:
  - Version pinning for all dependencies
  - Wrapper abstraction layer for external APIs
  - Regular dependency updates and testing
  - Monitoring for API deprecation notices

### Business Risks

**Risk 4: User Adoption**
- **Probability**: Medium
- **Impact**: High
- **Mitigation**:
  - Generous free tier to drive adoption
  - Comprehensive documentation and tutorials
  - n8n workflow templates to demonstrate value
  - Community engagement and support

**Risk 5: Cost Overruns**
- **Probability**: Low
- **Impact**: Medium
- **Mitigation**:
  - OCI cost monitoring and alerts
  - Auto-scaling based on demand
  - Tier-based rate limiting
  - Reserved instances for predictable workloads

### Security Risks

**Risk 6: Unauthorized Access**
- **Probability**: Low
- **Impact**: Critical
- **Mitigation**:
  - OAuth2 authentication with Central Auth
  - JWT token validation on every request
  - Rate limiting per user/tier
  - Comprehensive audit logging

**Risk 7: Data Breach**
- **Probability**: Low
- **Impact**: Critical
- **Mitigation**:
  - Encryption at rest and in transit (TLS 1.3)
  - Secrets management (OCI Vault)
  - Principle of least privilege
  - Regular security audits

---

## Part 9: Timeline & Milestones

### Week 1: Infrastructure Setup
- [ ] Provision OCI resources (VCN, subnets, compute)
- [ ] Setup PostgreSQL and Redis
- [ ] Configure load balancer
- [ ] Setup DNS records
- [ ] Obtain SSL certificates

### Week 2: Core Deployment
- [ ] Build and deploy MCP Gateway
- [ ] Integrate existing 60 tools
- [ ] Configure OAuth2 authentication
- [ ] Setup monitoring (Prometheus/Grafana)
- [ ] Deploy to staging environment

### Week 3: Cloud & Database Modules
- [ ] Integrate OCI MCP server (8 tools)
- [ ] Integrate Cloudflare MCP server (7 tools)
- [ ] Integrate Docker MCP server (5 tools)
- [ ] Integrate Neon MCP server (6 tools)
- [ ] Integrate PostgreSQL tools (5 tools)
- [ ] Integrate Redis tools (4 tools)
- [ ] **Milestone: 95 tools operational**

### Week 4: Communication & Developer Modules
- [ ] Integrate Twilio MCP server (6 tools)
- [ ] Integrate Slack MCP server (5 tools)
- [ ] Integrate Email tools (4 tools)
- [ ] Integrate GitHub MCP server (4 tools)
- [ ] Integrate GitLab MCP server (3 tools)
- [ ] Integrate Stripe MCP server (3 tools)
- [ ] **Milestone: 120 tools operational**

### Week 5: Testing & Optimization
- [ ] Run comprehensive integration tests
- [ ] Perform load testing
- [ ] Optimize performance bottlenecks
- [ ] Security audit
- [ ] Documentation review

### Week 6: Production Launch
- [ ] Deploy to production
- [ ] Configure DNS for both domains
- [ ] Launch monitoring dashboards
- [ ] Publish n8n workflow templates
- [ ] Announce to users
- [ ] **Milestone: Production live with 120+ tools**

---

## Part 10: Documentation Requirements

### Technical Documentation

1. **Architecture Guide**
   - System overview
   - Component diagrams
   - Data flow diagrams
   - Deployment architecture

2. **API Reference**
   - Complete tool catalog
   - Request/response schemas
   - Authentication flow
   - Error codes

3. **Integration Guides**
   - n8n integration tutorial
   - OAuth2 setup
   - Custom client development
   - Webhook configuration

4. **Operations Runbook**
   - Deployment procedures
   - Scaling guidelines
   - Backup and recovery
   - Incident response

### User Documentation

1. **Getting Started**
   - Account setup
   - Authentication
   - First tool call
   - n8n workflow creation

2. **Tool Tutorials**
   - OCI infrastructure management
   - Database operations
   - Communication workflows
   - Payment processing

3. **n8n Workflow Templates**
   - Database provisioning
   - Cloud monitoring
   - Payment automation
   - Notification workflows

4. **FAQ & Troubleshooting**
   - Common errors
   - Rate limiting
   - Authentication issues
   - Performance tips

---

## Conclusion

This expansion plan provides a comprehensive roadmap to double the After Dark Systems MCP infrastructure from 60+ to 120+ tools. The architecture is designed for:

- **Scalability**: Horizontal scaling via load balancing and containerization
- **Reliability**: 99.9% uptime target with redundancy and monitoring
- **Security**: OAuth2 authentication, encryption, and audit logging
- **Performance**: <500ms p95 latency with caching and optimization
- **Business Value**: Tiered subscription model driving $90K+ annual revenue

By leveraging existing OCI infrastructure, integrating proven MCP servers, and tightly coupling with the n8n workflow platform, this expansion positions After Dark Systems as a comprehensive MCP gateway provider serving both general-purpose AI applications and workflow automation use cases.

The 6-week timeline is aggressive but achievable given the modular architecture and extensive use of existing open-source MCP servers. The key to success will be:

1. Rigorous testing at each milestone
2. Incremental deployment (core → cloud → database → communication → developer)
3. Continuous monitoring and optimization
4. User feedback integration

**Next Steps:**
1. Review and approve this plan
2. Provision OCI infrastructure (Week 1)
3. Begin gateway development (Week 1-2)
4. Start module integration (Week 2-4)
5. Launch beta program (Week 5)
6. Production deployment (Week 6)

# Quick Start Guide: MCP Gateway Deployment
## Get from 60 to 120+ tools in 6 weeks

---

## Week 1: Foundation (Days 1-7)

### Day 1: Repository Setup
```bash
cd /Users/ryan/development/afterdark-mcp-builder

# Create gateway directory structure
mkdir -p gateway/{src,config,scripts}
mkdir -p gateway/src/{auth,routing,monitoring,modules}

# Initialize TypeScript project
cd gateway
npm init -y
npm install @modelcontextprotocol/sdk express cors redis ioredis
npm install jsonwebtoken jwks-rsa oci-sdk
npm install -D typescript @types/node @types/express @types/cors

# Copy implementation files from IMPLEMENTATION_GUIDE.md
# (server.ts, oauth-middleware.ts, module-router.ts, etc.)
```

### Day 2-3: OCI Infrastructure
```bash
# Login to OCI
oci session authenticate

# Create compartment
oci iam compartment create \
  --name "mcp-services" \
  --description "MCP Gateway Services" \
  --compartment-id <parent-compartment-id>

# Get compartment ID
export MCP_COMPARTMENT_ID=$(oci iam compartment list \
  --name "mcp-services" \
  --query 'data[0].id' --raw-output)

# Create VCN
oci network vcn create \
  --compartment-id $MCP_COMPARTMENT_ID \
  --cidr-block "10.0.0.0/16" \
  --display-name "mcp-vcn" \
  --wait-for-state AVAILABLE

# Create subnets
oci network subnet create \
  --compartment-id $MCP_COMPARTMENT_ID \
  --vcn-id <vcn-id> \
  --cidr-block "10.0.1.0/24" \
  --display-name "mcp-public-subnet"
```

### Day 4-5: Database & Redis Setup
```bash
# SSH to existing n8n instance
ssh opc@n8nworkflo.ws

# Create MCP database
sudo docker exec -it n8n-postgres psql -U postgres -c "CREATE DATABASE mcpdb;"
sudo docker exec -it n8n-postgres psql -U postgres -c "CREATE USER mcpuser WITH PASSWORD 'strong-password';"
sudo docker exec -it n8n-postgres psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE mcpdb TO mcpuser;"

# Create schema
sudo docker exec -it n8n-postgres psql -U postgres -d mcpdb << 'EOF'
CREATE SCHEMA mcp_gateway;

CREATE TABLE mcp_gateway.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  tier VARCHAR(20) NOT NULL DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE mcp_gateway.tool_usage (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES mcp_gateway.users(id),
  tool_name VARCHAR(100) NOT NULL,
  execution_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tool_usage_user ON mcp_gateway.tool_usage(user_id);
CREATE INDEX idx_tool_usage_created ON mcp_gateway.tool_usage(created_at);

CREATE TABLE mcp_gateway.rate_limits (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES mcp_gateway.users(id),
  hour_bucket TIMESTAMP NOT NULL,
  request_count INTEGER DEFAULT 0,
  UNIQUE(user_id, hour_bucket)
);
EOF

# Deploy Redis container (if not already running)
sudo docker run -d \
  --name mcp-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  -v /data/mcp-redis:/data \
  redis:7-alpine redis-server --appendonly yes
```

### Day 6-7: SSL Certificates & DNS
```bash
# Install certbot (if not already installed)
sudo yum install -y certbot

# Stop nginx temporarily (if running)
sudo systemctl stop nginx

# Generate certificates
sudo certbot certonly --standalone \
  -d mcp.afterdarksys.com \
  -d mcp.n8nworkflo.ws \
  --email admin@afterdarksys.com \
  --agree-tos \
  --non-interactive

# Restart nginx
sudo systemctl start nginx

# Update DNS records (use your DNS provider's API or web interface)
# mcp.afterdarksys.com -> A record -> <OCI-LB-IP>
# mcp.n8nworkflo.ws -> A record -> <OCI-LB-IP>
```

---

## Week 2: Core Gateway (Days 8-14)

### Day 8-9: Build Gateway Application
```bash
cd /Users/ryan/development/afterdark-mcp-builder/gateway

# Create main server file (copy from IMPLEMENTATION_GUIDE.md)
cat > src/server.ts << 'EOF'
// (Paste server.ts content from IMPLEMENTATION_GUIDE.md)
EOF

# Create OAuth middleware
cat > src/auth/oauth-middleware.ts << 'EOF'
// (Paste oauth-middleware.ts content)
EOF

# Create module router
cat > src/routing/module-router.ts << 'EOF'
// (Paste module-router.ts content)
EOF

# Build
npm run build
```

### Day 10-11: Docker Configuration
```bash
# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN addgroup -g 1001 -S mcpuser && adduser -S mcpuser -u 1001
USER mcpuser
EXPOSE 3000
CMD ["node", "dist/server.js"]
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  mcp-gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://mcpuser:password@host.docker.internal:5432/mcpdb
      - REDIS_URL=redis://host.docker.internal:6379
    restart: unless-stopped
EOF
```

### Day 12-13: Initial Deployment
```bash
# Build image
docker build -t mcp-gateway:latest .

# Test locally
docker-compose up -d

# Test health endpoint
curl http://localhost:3000/health

# Deploy to OCI
rsync -avz ./ opc@n8nworkflo.ws:/opt/mcp-gateway/
ssh opc@n8nworkflo.ws 'cd /opt/mcp-gateway && docker-compose up -d'
```

### Day 14: Monitoring Setup
```bash
# Create prometheus.yml
cat > config/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'mcp-gateway'
    static_configs:
      - targets: ['mcp-gateway:3000']
EOF

# Add to docker-compose.yml
cat >> docker-compose.yml << 'EOF'
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
EOF

# Restart
docker-compose up -d
```

---

## Week 3: Cloud & Database Modules (Days 15-21)

### Day 15-16: OCI Module Integration
```bash
cd /Users/ryan/development/afterdark-mcp-builder

# Clone OCI MCP server
git clone https://github.com/jopsis/mcp-server-oci.git modules/cloud/oci
cd modules/cloud/oci
npm install
npm run build

# Create integration wrapper (see IMPLEMENTATION_GUIDE.md for full code)
mkdir -p gateway/src/modules/cloud/oci
cat > gateway/src/modules/cloud/oci/index.ts << 'EOF'
// (Paste OCI module code from IMPLEMENTATION_GUIDE.md)
EOF
```

### Day 17: Cloudflare Module Integration
```bash
# Clone Cloudflare MCP server
git clone https://github.com/cloudflare/mcp-server-cloudflare.git modules/cloud/cloudflare
cd modules/cloud/cloudflare
npm install
npm run build

# Create wrapper
mkdir -p gateway/src/modules/cloud/cloudflare
# (Create integration wrapper similar to OCI)
```

### Day 18: Docker Module Integration
```bash
# Clone Docker MCP server
git clone https://github.com/QuantGeekDev/docker-mcp.git modules/cloud/docker
cd modules/cloud/docker
pip install -r requirements.txt

# Create Node.js wrapper to call Python server
# (Docker MCP is Python-based, create subprocess wrapper)
```

### Day 19-20: Database Modules (Neon, PostgreSQL, Redis)
```bash
# Neon
git clone https://github.com/neondatabase/mcp-server-neon.git modules/database/neon
cd modules/database/neon && npm install && npm run build

# PostgreSQL (use official Anthropic server)
cd modules/database
npx @modelcontextprotocol/create-server postgres

# Redis (custom implementation)
mkdir -p modules/database/redis
# Create custom Redis tools wrapper
```

### Day 21: Test Cloud & Database Modules
```bash
# Update gateway to load new modules
cd gateway
npm run build
docker-compose restart mcp-gateway

# Test tool count
curl -H "Authorization: Bearer $TEST_TOKEN" \
  http://localhost:3000/mcp/tools | jq '.totalTools'
# Should show ~95 tools (60 core + 35 new)
```

---

## Week 4: Communication & Developer Modules (Days 22-28)

### Day 22-23: Communication Modules
```bash
# Twilio
git clone https://github.com/YiyangLi/sms-mcp-server.git modules/communication/twilio
cd modules/communication/twilio && npm install && npm run build

# Slack (official)
cd modules/communication
npx @modelcontextprotocol/create-server slack

# Email (custom)
mkdir -p modules/communication/email
# Implement SMTP/IMAP wrapper
```

### Day 24-25: Developer Modules
```bash
# GitHub (official)
cd modules/developer
npx @modelcontextprotocol/create-server github

# GitLab
git clone https://gitlab.com/gitlab-org/mcp-server-gitlab.git gitlab
cd gitlab && npm install && npm run build

# Stripe
npm install @stripe/agent-toolkit
mkdir stripe
# Create Stripe wrapper
```

### Day 26: Integration & Testing
```bash
# Rebuild gateway with all modules
cd gateway
npm run build
docker-compose restart mcp-gateway

# Comprehensive test
curl -H "Authorization: Bearer $TEST_TOKEN" \
  http://localhost:3000/mcp/tools | jq '.totalTools'
# Should show 120+ tools

# Test each module
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "oci_list_compute_instances",
      "arguments": {"compartmentId": "ocid1.compartment..."}
    },
    "id": 1
  }'
```

### Day 27-28: Load Testing & Optimization
```bash
# Install k6
brew install k6  # or appropriate package manager

# Run load test
k6 run load-test.js

# Monitor metrics
open http://localhost:9090  # Prometheus
open http://localhost:3001  # Grafana

# Optimize based on results
# - Add caching for frequently used tools
# - Increase connection pool sizes
# - Add more gateway instances if needed
```

---

## Week 5: Testing & Documentation (Days 29-35)

### Day 29-30: Integration Tests
```bash
# Create test suite
mkdir -p gateway/test
npm install -D jest @types/jest ts-jest

# Run tests
npm test
```

### Day 31-32: n8n Integration
```bash
# Install n8n MCP node
cd /path/to/n8n
npm install n8n-nodes-mcp-gateway

# Create workflow templates
# Import example workflows from IMPLEMENTATION_GUIDE.md

# Test workflows
# 1. Database provisioning workflow
# 2. Cloud monitoring workflow
# 3. Payment processing workflow
```

### Day 33-34: Documentation
```bash
# Generate API documentation
npm install -D typedoc
npx typedoc src/

# Create user guides
# - Getting Started
# - Tool Reference
# - n8n Integration Guide
# - Troubleshooting
```

### Day 35: Security Audit
```bash
# Run security scan
npm audit
docker scan mcp-gateway:latest

# Review configurations
# - OAuth settings
# - Rate limits
# - Database permissions
# - Network security groups
```

---

## Week 6: Production Launch (Days 36-42)

### Day 36-37: Production Deployment
```bash
# Run deployment script
./scripts/deploy-production.sh

# Configure OCI Load Balancer
# (Use OCI Console or CLI)

# Update DNS to point to Load Balancer
# Test both domains:
# - https://mcp.afterdarksys.com
# - https://mcp.n8nworkflo.ws
```

### Day 38: Monitoring & Alerting
```bash
# Configure alerts in Grafana
# - High error rate
# - High response time
# - Gateway down
# - Database connection issues

# Setup notification channels
# - Slack
# - Email
# - PagerDuty
```

### Day 39-40: User Onboarding
```bash
# Create user accounts
# Set up tier limits in database

# Publish n8n workflow templates to n8n community
# - Database provisioning
# - Cloud monitoring
# - Payment automation

# Announce launch
# - Blog post
# - Email to users
# - Social media
```

### Day 41: Final Testing
```bash
# End-to-end tests
# 1. User signup → OAuth → Tool execution
# 2. Free tier rate limiting
# 3. Enterprise tier full access
# 4. n8n workflow execution
# 5. Failover testing
# 6. Load balancer health checks

# Performance validation
# - p95 latency < 500ms ✓
# - 99.9% uptime ✓
# - 120+ tools available ✓
```

### Day 42: Production Monitoring
```bash
# Monitor first 24 hours
# - Check error rates
# - Monitor resource usage
# - Review user feedback
# - Optimize as needed

# Success metrics
# - Tool count: 120+ ✓
# - Response time: <500ms ✓
# - Uptime: 99.9%+ ✓
# - User registrations: Track
```

---

## Quick Command Reference

### Essential Commands

```bash
# Health check
curl https://mcp.afterdarksys.com/health

# List tools
curl -H "Authorization: Bearer $TOKEN" \
  https://mcp.afterdarksys.com/mcp/tools

# Execute tool
curl -X POST https://mcp.afterdarksys.com/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "oci_list_compute_instances",
      "arguments": {"compartmentId": "ocid1..."}
    },
    "id": 1
  }'

# View metrics
open http://<oci-ip>:9090  # Prometheus
open http://<oci-ip>:3001  # Grafana

# View logs
docker-compose logs -f mcp-gateway

# Restart gateway
docker-compose restart mcp-gateway

# Scale gateway
docker-compose up -d --scale mcp-gateway=3
```

### Troubleshooting

```bash
# Check gateway status
docker ps | grep mcp-gateway

# View detailed logs
docker-compose logs --tail=100 mcp-gateway

# Test database connection
docker exec -it mcp-gateway node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.query('SELECT NOW()').then(r => console.log(r.rows));
"

# Test Redis connection
docker exec -it mcp-redis redis-cli ping

# Check OAuth endpoint
curl https://auth.afterdarksys.com/.well-known/openid-configuration
```

---

## Success Criteria Checklist

- [ ] **Infrastructure**: OCI VCN, subnets, load balancer configured
- [ ] **Database**: PostgreSQL with MCP schema created
- [ ] **Cache**: Redis deployed and accessible
- [ ] **SSL**: Certificates for both domains configured
- [ ] **DNS**: Both domains pointing to load balancer
- [ ] **Gateway**: Core gateway deployed and running
- [ ] **Modules**: All 5 modules integrated (Core, Cloud, DB, Comm, Dev)
- [ ] **Tools**: 120+ tools available and tested
- [ ] **Auth**: OAuth2 integration with Central Auth working
- [ ] **Tiers**: Tier-based access control functioning
- [ ] **Rate Limits**: Per-tier rate limiting enforced
- [ ] **Monitoring**: Prometheus + Grafana dashboards live
- [ ] **n8n**: MCP Client node configured and tested
- [ ] **Workflows**: At least 3 example workflows published
- [ ] **Documentation**: API docs, user guides completed
- [ ] **Testing**: Integration tests passing, load tests successful
- [ ] **Production**: Deployed to production, both domains accessible
- [ ] **Performance**: <500ms p95 latency, 99.9% uptime

---

## Next Steps After Launch

1. **Week 7-8**: Gather user feedback, optimize performance
2. **Week 9-10**: Add requested features, fix bugs
3. **Month 2**: Develop additional custom modules
4. **Month 3**: Enterprise customer onboarding
5. **Quarter 2**: Expand to 200+ tools, international deployment

---

## Support & Resources

- **Documentation**: `/docs` directory in repository
- **Issues**: GitHub Issues for bug reports
- **Slack**: #mcp-gateway channel for team communication
- **Monitoring**: Grafana dashboard for real-time metrics
- **Logs**: CloudWatch or local logs for debugging

Good luck with your deployment!

# AWS Deployment Guide - Unified MCP Server

Complete guide to deploying the Unified MCP HTTP Server to AWS with Terraform and Ansible.

## 🎯 Deployment Overview

- **Instance Type**: t4g.nano (ARM-based, cheapest at ~$3/month)
- **Domain**: mcp.afterdarksys.com
- **SSL**: Automatic via Let's Encrypt
- **HTTP → HTTPS**: Automatic redirect
- **Infrastructure as Code**: Terraform + Ansible

---

## 💰 Cost Breakdown

| Resource | Monthly Cost |
|----------|--------------|
| EC2 t4g.nano | ~$3.00 |
| EBS 8GB gp3 | ~$0.80 |
| Elastic IP | $0.00 (while attached) |
| Data Transfer | ~$0.10 (minimal) |
| **Total** | **~$4/month** |

*Note: First 12 months may be free tier eligible with t3.nano instead*

---

## 📋 Prerequisites

### 1. Install Required Tools

```bash
# Terraform
brew install terraform  # macOS
# or download from https://www.terraform.io/downloads

# Ansible
pip install ansible

# AWS CLI
brew install awscli  # macOS
# or download from https://aws.amazon.com/cli/

# Verify installations
terraform --version
ansible --version
aws --version
```

### 2. AWS Account Setup

```bash
# Configure AWS credentials
aws configure

# Set environment variables (optional)
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
```

### 3. Create SSH Key Pair

```bash
# Create new key pair in AWS
aws ec2 create-key-pair \
  --key-name mcp-server-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/mcp-server-key.pem

# Set correct permissions
chmod 400 ~/.ssh/mcp-server-key.pem

# Or use existing key pair name in terraform.tfvars
```

---

## 🚀 Quick Deployment (Automated)

### One-Command Deployment

```bash
# Set required environment variables
export MCP_API_KEY="your-super-secret-key-here"
export LETSENCRYPT_EMAIL="admin@afterdarksys.com"
export DOMAIN_NAME="mcp.afterdarksys.com"
export SSH_KEY_PATH="~/.ssh/mcp-server-key.pem"

# Run deployment script
./deploy.sh
```

The script will:
1. ✅ Check requirements
2. ✅ Deploy AWS infrastructure with Terraform
3. ✅ Wait for instance to be ready
4. ✅ Build and deploy Docker image
5. ✅ Configure server with Ansible
6. ✅ Set up SSL certificates
7. ✅ Configure HTTP → HTTPS redirect
8. ✅ Test deployment

---

## 📝 Step-by-Step Manual Deployment

### Step 1: Configure Terraform

```bash
cd terraform

# Copy example configuration
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars
nano terraform.tfvars
```

**Edit these values:**

```hcl
# AWS Configuration
aws_region = "us-east-1"
instance_type = "t4g.nano"  # Cheapest option
key_pair_name = "mcp-server-key"

# Security - CHANGE THIS!
ssh_allowed_ips = ["YOUR_IP/32"]  # Your IP for SSH access

# Domain
domain_name = "mcp.afterdarksys.com"
root_domain = "afterdarksys.com"

# Route 53 (if you manage DNS in AWS)
create_route53_records = false  # Set to true if using Route 53

# MCP Configuration
mcp_api_key = "your-super-secret-api-key-here"
```

### Step 2: Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Review plan
terraform plan

# Apply
terraform apply
# Type 'yes' when prompted

# Save outputs
export MCP_SERVER_IP=$(terraform output -raw instance_public_ip)
export INSTANCE_ID=$(terraform output -raw instance_id)

echo "Server IP: $MCP_SERVER_IP"
```

### Step 3: Update DNS

**If NOT using Route 53:**

1. Go to your DNS provider (Cloudflare, Namecheap, etc.)
2. Add an A record:
   - Name: `mcp`
   - Type: `A`
   - Value: `$MCP_SERVER_IP`
   - TTL: `300` (5 minutes)

3. Wait for DNS propagation (5-30 minutes):

```bash
# Test DNS resolution
dig mcp.afterdarksys.com
nslookup mcp.afterdarksys.com
```

### Step 4: Build Docker Image

```bash
cd /path/to/unified-mcp-server

# Build image
docker build -t unified-mcp-server:latest .

# Save image
docker save unified-mcp-server:latest | gzip > /tmp/unified-mcp-server.tar.gz

# Copy to server
scp -i ~/.ssh/mcp-server-key.pem \
  /tmp/unified-mcp-server.tar.gz \
  ec2-user@$MCP_SERVER_IP:/tmp/

# Load on server
ssh -i ~/.ssh/mcp-server-key.pem ec2-user@$MCP_SERVER_IP \
  "docker load < /tmp/unified-mcp-server.tar.gz"
```

### Step 5: Configure with Ansible

```bash
cd ansible

# Set environment variables
export MCP_SERVER_IP=your-server-ip
export MCP_API_KEY=your-api-key
export LETSENCRYPT_EMAIL=admin@afterdarksys.com
export DOMAIN_NAME=mcp.afterdarksys.com

# Run playbook
ansible-playbook -i inventory.yml playbook.yml
```

### Step 6: Verify Deployment

```bash
# Test HTTP redirect (should return 301/302)
curl -I http://mcp.afterdarksys.com

# Test HTTPS health endpoint
curl https://mcp.afterdarksys.com/health

# Test SSE endpoint
curl -N https://mcp.afterdarksys.com/sse \
  -H "Authorization: Bearer your-api-key"
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Required
export MCP_API_KEY="your-secret-key"

# Optional
export DOMAIN_NAME="mcp.afterdarksys.com"
export LETSENCRYPT_EMAIL="admin@afterdarksys.com"
export SSH_KEY_PATH="~/.ssh/mcp-server-key.pem"
```

### Terraform Variables

Edit `terraform/terraform.tfvars`:

```hcl
# Change instance type for better performance
instance_type = "t4g.micro"  # ~$6/month, 1 GB RAM

# Enable Route 53 DNS management
create_route53_records = true

# Restrict SSH access
ssh_allowed_ips = ["YOUR_IP/32"]

# Enable detailed monitoring
enable_monitoring = true  # +$2.10/month
```

---

## 🔐 SSL Certificate (Let's Encrypt)

### Automatic Setup

Ansible automatically configures Let's Encrypt SSL certificates:

```bash
# Certificate is obtained during Ansible run
# Auto-renewal is configured via cron
# Certificates renew every 60 days
```

### Manual SSL Setup

```bash
# SSH to server
ssh -i ~/.ssh/mcp-server-key.pem ec2-user@$MCP_SERVER_IP

# Obtain certificate
sudo certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email admin@afterdarksys.com \
  --domains mcp.afterdarksys.com \
  --redirect
```

### Test Renewal

```bash
# Dry run
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal
```

---

## 🌐 HTTP → HTTPS Redirect

Nginx is configured to automatically redirect all HTTP traffic to HTTPS:

```nginx
server {
    listen 80;
    server_name mcp.afterdarksys.com;

    location / {
        return 301 https://$server_name$request_uri;
    }
}
```

**Test:**

```bash
curl -I http://mcp.afterdarksys.com
# Should return: HTTP/1.1 301 Moved Permanently
# Location: https://mcp.afterdarksys.com/
```

---

## 🔌 Connect to Claude Desktop

### Option 1: Download Config

```bash
curl https://mcp.afterdarksys.com/download/mcp_servers.json > mcp_servers.json

# Copy to Claude config directory
cp mcp_servers.json ~/Library/Application\ Support/Claude/
```

### Option 2: Manual Configuration

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unified-mcp-afterdark": {
      "url": "https://mcp.afterdarksys.com/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer your-api-key-here"
      }
    }
  }
}
```

---

## 📊 Monitoring & Management

### View Logs

```bash
# SSH to server
ssh -i ~/.ssh/mcp-server-key.pem ec2-user@$MCP_SERVER_IP

# View MCP server logs
sudo journalctl -u mcp-server -f

# View Nginx logs
sudo tail -f /var/log/nginx/mcp-access.log
sudo tail -f /var/log/nginx/mcp-error.log

# View Docker logs
docker-compose -f /opt/mcp-server/docker-compose.yml logs -f
```

### Health Checks

```bash
# Server health
curl https://mcp.afterdarksys.com/health

# Metrics
curl https://mcp.afterdarksys.com/metrics

# Server info
curl -H "Authorization: Bearer your-key" \
  https://mcp.afterdarksys.com/api/mcp/info
```

### Restart Service

```bash
ssh -i ~/.ssh/mcp-server-key.pem ec2-user@$MCP_SERVER_IP

# Restart MCP server
sudo systemctl restart mcp-server

# Restart Nginx
sudo systemctl restart nginx

# View status
sudo systemctl status mcp-server
```

---

## 🔄 Updates & Maintenance

### Update Application

```bash
# Build new image
docker build -t unified-mcp-server:latest .

# Copy to server
docker save unified-mcp-server:latest | gzip > /tmp/unified-mcp-server.tar.gz
scp -i ~/.ssh/mcp-server-key.pem /tmp/unified-mcp-server.tar.gz ec2-user@$MCP_SERVER_IP:/tmp/

# Deploy
ssh -i ~/.ssh/mcp-server-key.pem ec2-user@$MCP_SERVER_IP << 'EOF'
  docker load < /tmp/unified-mcp-server.tar.gz
  cd /opt/mcp-server
  docker-compose down
  docker-compose up -d
EOF
```

### Update Infrastructure

```bash
cd terraform

# Review changes
terraform plan

# Apply updates
terraform apply
```

### System Updates

```bash
ssh -i ~/.ssh/mcp-server-key.pem ec2-user@$MCP_SERVER_IP

# Update packages
sudo dnf update -y

# Reboot if needed
sudo reboot
```

---

## 🗑️ Teardown / Cleanup

### Destroy Everything

```bash
cd terraform

# Destroy all AWS resources
terraform destroy
# Type 'yes' when prompted
```

### Manual Cleanup

```bash
# Delete EC2 instance
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

# Release Elastic IP
aws ec2 release-address --allocation-id $ALLOCATION_ID

# Delete security group
aws ec2 delete-security-group --group-id $SG_ID

# Delete VPC (and all associated resources)
aws ec2 delete-vpc --vpc-id $VPC_ID
```

---

## 🐛 Troubleshooting

### Instance Not Accessible

```bash
# Check instance status
aws ec2 describe-instance-status --instance-ids $INSTANCE_ID

# Check security group rules
aws ec2 describe-security-groups --group-ids $SG_ID

# Test SSH
ssh -v -i ~/.ssh/mcp-server-key.pem ec2-user@$MCP_SERVER_IP
```

### SSL Certificate Issues

```bash
# Check certificate
echo | openssl s_client -servername mcp.afterdarksys.com -connect mcp.afterdarksys.com:443

# Manually obtain
ssh -i ~/.ssh/mcp-server-key.pem ec2-user@$MCP_SERVER_IP
sudo certbot certificates
sudo certbot renew
```

### Service Not Starting

```bash
ssh -i ~/.ssh/mcp-server-key.pem ec2-user@$MCP_SERVER_IP

# Check logs
sudo journalctl -u mcp-server -n 100

# Check Docker
docker ps
docker-compose -f /opt/mcp-server/docker-compose.yml ps

# Restart
sudo systemctl restart mcp-server
```

### DNS Not Resolving

```bash
# Test DNS
dig mcp.afterdarksys.com
nslookup mcp.afterdarksys.com

# Check NS records
dig NS afterdarksys.com

# Wait for propagation (can take 30+ minutes)
```

---

## 📚 Additional Resources

- **Terraform Docs**: https://www.terraform.io/docs
- **Ansible Docs**: https://docs.ansible.com/
- **AWS EC2 Pricing**: https://aws.amazon.com/ec2/pricing/
- **Let's Encrypt**: https://letsencrypt.org/
- **Certbot**: https://certbot.eff.org/

---

## 🆘 Support

For issues or questions:
- Check logs: `journalctl -u mcp-server -f`
- Review Nginx config: `/etc/nginx/conf.d/mcp-server.conf`
- Test endpoints: `curl https://mcp.afterdarksys.com/health`

---

**🎉 Your MCP server is now deployed on AWS with HTTPS and automatic SSL!**

Monthly cost: ~$4 | Domain: mcp.afterdarksys.com | HTTP → HTTPS: ✅

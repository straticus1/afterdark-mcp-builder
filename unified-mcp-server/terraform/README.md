# Terraform Configuration for Unified MCP Server

Infrastructure as Code for deploying Unified MCP Server to AWS.

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Internet Gateway              │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│        VPC (10.0.0.0/16)                │
│                                         │
│  ┌────────────────────────────────────┐ │
│  │  Public Subnet (10.0.1.0/24)      │ │
│  │                                    │ │
│  │  ┌──────────────────────────────┐ │ │
│  │  │ EC2 t4g.nano (~$3/month)     │ │ │
│  │  │ - Docker                     │ │ │
│  │  │ - Nginx (HTTP→HTTPS)         │ │ │
│  │  │ - Let's Encrypt SSL          │ │ │
│  │  │ - MCP Server (port 3000)     │ │ │
│  │  └──────────────────────────────┘ │ │
│  │                                    │ │
│  │  Elastic IP (Static)               │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Security Group:                        │
│  - SSH (22) - Your IP only             │
│  - HTTP (80) - All                     │
│  - HTTPS (443) - All                   │
│  - MCP (3000) - Optional               │
└─────────────────────────────────────────┘
```

## 📋 Resources Created

- **VPC** - Virtual Private Cloud (10.0.0.0/16)
- **Subnet** - Public subnet (10.0.1.0/24)
- **Internet Gateway** - For internet access
- **Route Table** - Routes traffic to IGW
- **Security Group** - Firewall rules
- **EC2 Instance** - t4g.nano (ARM-based, cheapest)
- **Elastic IP** - Static IP address
- **IAM Role** - For SSM access
- **CloudWatch Alarm** - CPU monitoring
- **Route 53 Record** - (Optional) DNS A record

## 💰 Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| EC2 t4g.nano | $3.00 |
| EBS 8GB gp3 | $0.80 |
| Elastic IP | $0.00 (while attached) |
| Data Transfer | ~$0.10 |
| **Total** | **~$4/month** |

## 🚀 Quick Start

```bash
# 1. Copy example vars
cp terraform.tfvars.example terraform.tfvars

# 2. Edit configuration
nano terraform.tfvars

# 3. Initialize
terraform init

# 4. Plan
terraform plan

# 5. Apply
terraform apply
```

## 🔧 Configuration

### Required Variables

Edit `terraform.tfvars`:

```hcl
# AWS
aws_region = "us-east-1"
key_pair_name = "mcp-server-key"  # Must exist in AWS

# Security
ssh_allowed_ips = ["YOUR_IP/32"]  # Change this!

# Domain
domain_name = "mcp.afterdarksys.com"

# MCP
mcp_api_key = "your-secret-key"  # Change this!
```

### Optional Variables

```hcl
# Use more powerful instance
instance_type = "t4g.micro"  # ~$6/month

# Enable Route 53
create_route53_records = true

# Enable detailed monitoring
enable_monitoring = true  # +$2.10/month
```

## 📤 Outputs

After `terraform apply`, you'll get:

```bash
instance_id = "i-1234567890abcdef"
instance_public_ip = "54.123.45.67"
domain_name = "mcp.afterdarksys.com"
mcp_https_url = "https://mcp.afterdarksys.com"
mcp_sse_endpoint = "https://mcp.afterdarksys.com/sse"
ssh_command = "ssh -i mcp-server-key.pem ec2-user@54.123.45.67"
```

## 🔐 State Management

### Local State (Default)

State is stored locally in `terraform.tfstate`.

### Remote State (Recommended)

Use S3 backend for team collaboration:

```hcl
# In main.tf, uncomment and configure:
backend "s3" {
  bucket = "afterdark-terraform-state"
  key    = "mcp-server/terraform.tfstate"
  region = "us-east-1"
}
```

Create the bucket:

```bash
aws s3 mb s3://afterdark-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket afterdark-terraform-state \
  --versioning-configuration Status=Enabled
```

## 🌍 Multiple Environments

### Production

```bash
terraform workspace new production
terraform workspace select production
terraform apply -var-file=production.tfvars
```

### Staging

```bash
terraform workspace new staging
terraform workspace select staging
terraform apply -var-file=staging.tfvars
```

## 📊 Monitoring

CloudWatch alarm for high CPU:

```bash
# View alarms
aws cloudwatch describe-alarms --alarm-names mcp-server-high-cpu

# Set SNS topic for alerts
# In terraform.tfvars:
alarm_sns_topic_arn = "arn:aws:sns:us-east-1:123456789:alerts"
```

## 🗑️ Cleanup

```bash
# Destroy all resources
terraform destroy

# Or destroy specific resource
terraform destroy -target=aws_instance.mcp_server
```

## 🔍 Useful Commands

```bash
# View current state
terraform show

# List all resources
terraform state list

# Get specific output
terraform output instance_public_ip

# Format code
terraform fmt

# Validate
terraform validate

# View execution plan
terraform plan -out=tfplan

# Apply saved plan
terraform apply tfplan
```

## 🐛 Troubleshooting

### SSH Key Not Found

```bash
# Create key pair
aws ec2 create-key-pair \
  --key-name mcp-server-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/mcp-server-key.pem

chmod 400 ~/.ssh/mcp-server-key.pem
```

### Instance Not Accessible

```bash
# Check security group
terraform state show aws_security_group.mcp_server

# Update allowed IPs
# Edit terraform.tfvars and re-apply
terraform apply
```

### State Lock

```bash
# If state is locked
terraform force-unlock LOCK_ID
```

## 📚 Files

```
terraform/
├── main.tf                    # Main configuration
├── variables.tf               # Variable definitions
├── terraform.tfvars.example   # Example variables
├── terraform.tfvars           # Your variables (gitignored)
├── user_data.sh              # EC2 bootstrap script
└── README.md                 # This file
```

## 🔗 Resources

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EC2 Pricing](https://aws.amazon.com/ec2/pricing/)
- [Terraform Best Practices](https://www.terraform-best-practices.com/)

---

**Cost Optimized** | **Production Ready** | **Fully Automated**

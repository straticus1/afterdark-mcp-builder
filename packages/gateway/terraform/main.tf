terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Configure this with your S3 bucket for state storage
    # bucket = "afterdark-terraform-state"
    # key    = "mcp-server/terraform.tfstate"
    # region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "unified-mcp-server"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "AfterDarkSystems"
    }
  }
}

# Data sources
data "aws_ami" "amazon_linux_2023_arm" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# VPC and Networking
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "mcp-server-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "mcp-server-igw"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "mcp-server-public-subnet"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "mcp-server-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Security Group
resource "aws_security_group" "mcp_server" {
  name        = "mcp-server-sg"
  description = "Security group for MCP server"
  vpc_id      = aws_vpc.main.id

  # SSH
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_ips
    description = "SSH access"
  }

  # HTTP
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP access"
  }

  # HTTPS
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS access"
  }

  # MCP Server (for direct access if needed)
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = var.mcp_allowed_ips
    description = "MCP server direct access"
  }

  # Outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "mcp-server-sg"
  }
}

# IAM Role for EC2
resource "aws_iam_role" "mcp_server" {
  name = "mcp-server-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "mcp-server-role"
  }
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.mcp_server.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "mcp_server" {
  name = "mcp-server-profile"
  role = aws_iam_role.mcp_server.name
}

# EC2 Instance (Cheapest option: t4g.nano ARM-based)
resource "aws_instance" "mcp_server" {
  ami                    = data.aws_ami.amazon_linux_2023_arm.id
  instance_type          = var.instance_type  # t4g.nano is cheapest at ~$3/month
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.mcp_server.id]
  iam_instance_profile   = aws_iam_instance_profile.mcp_server.name
  key_name               = var.key_pair_name

  root_block_device {
    volume_size           = 8  # Minimum size (free tier eligible)
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true
  }

  user_data = templatefile("${path.module}/user_data.sh", {
    api_key     = var.mcp_api_key
    domain_name = var.domain_name
  })

  tags = {
    Name = "mcp-server"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Elastic IP for stable IP address
resource "aws_eip" "mcp_server" {
  instance = aws_instance.mcp_server.id
  domain   = "vpc"

  tags = {
    Name = "mcp-server-eip"
  }

  depends_on = [aws_internet_gateway.main]
}

# Route 53 (only if you own the domain in AWS)
data "aws_route53_zone" "main" {
  count = var.create_route53_records ? 1 : 0
  name  = var.root_domain
}

resource "aws_route53_record" "mcp" {
  count   = var.create_route53_records ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.mcp_server.public_ip]
}

# CloudWatch Alarms (optional but recommended)
resource "aws_cloudwatch_metric_alarm" "cpu" {
  alarm_name          = "mcp-server-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "CPU utilization is too high"

  dimensions = {
    InstanceId = aws_instance.mcp_server.id
  }

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
}

# Outputs
output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.mcp_server.id
}

output "instance_public_ip" {
  description = "Public IP address"
  value       = aws_eip.mcp_server.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name"
  value       = aws_instance.mcp_server.public_dns
}

output "domain_name" {
  description = "Domain name"
  value       = var.domain_name
}

output "mcp_https_url" {
  description = "HTTPS URL for MCP server"
  value       = "https://${var.domain_name}"
}

output "mcp_sse_endpoint" {
  description = "SSE endpoint for Claude Desktop"
  value       = "https://${var.domain_name}/sse"
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ${var.key_pair_name}.pem ec2-user@${aws_eip.mcp_server.public_ip}"
}

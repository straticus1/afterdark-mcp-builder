variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"  # Cheapest region typically
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "instance_type" {
  description = "EC2 instance type (t4g.nano is cheapest at ~$3/month)"
  type        = string
  default     = "t4g.nano"  # ARM-based, $0.0042/hour = ~$3/month

  # Other cheap options:
  # - t3.nano: $0.0052/hour = ~$3.80/month (x86, free tier eligible)
  # - t4g.micro: $0.0084/hour = ~$6/month (ARM, better performance)
}

variable "key_pair_name" {
  description = "Name of SSH key pair (must exist in AWS)"
  type        = string
  default     = "mcp-server-key"
}

variable "ssh_allowed_ips" {
  description = "IPs allowed to SSH (your IP for security)"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Change this to your IP for security!
}

variable "mcp_allowed_ips" {
  description = "IPs allowed to access MCP port 3000 directly"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Nginx will handle access control
}

variable "domain_name" {
  description = "Domain name for MCP server"
  type        = string
  default     = "mcp.afterdarksys.com"
}

variable "root_domain" {
  description = "Root domain (if using Route 53)"
  type        = string
  default     = "afterdarksys.com"
}

variable "create_route53_records" {
  description = "Create Route 53 DNS records (requires domain in Route 53)"
  type        = bool
  default     = false  # Set to true if you own the domain in Route 53
}

variable "mcp_api_key" {
  description = "API key for MCP server"
  type        = string
  sensitive   = true
  default     = ""  # Set via TF_VAR_mcp_api_key or terraform.tfvars
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "enable_monitoring" {
  description = "Enable detailed monitoring ($2.10/month extra)"
  type        = bool
  default     = false  # Keep false for cheapest option
}

variable "associate_public_ip_address" {
  description = "Associate public IP address"
  type        = bool
  default     = true
}

variable "enable_termination_protection" {
  description = "Enable termination protection"
  type        = bool
  default     = false
}

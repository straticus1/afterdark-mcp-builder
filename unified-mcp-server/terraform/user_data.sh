#!/bin/bash
set -e

# Update system
dnf update -y

# Install dependencies
dnf install -y \
  docker \
  git \
  python3-pip \
  amazon-cloudwatch-agent \
  certbot \
  python3-certbot-nginx

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -aG docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create application directory
mkdir -p /opt/mcp-server
cd /opt/mcp-server

# Clone or prepare application
# Note: In production, you'd pull from a git repo or S3
# For now, we'll create docker-compose.yml directly

cat > /opt/mcp-server/.env << EOF
API_KEY=${api_key}
MODULES=filesystem,memory,terminal
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
WORKSPACE_PATH=/opt/mcp-server/workspace
EOF

# Create workspace directory
mkdir -p /opt/mcp-server/workspace
chown -R ec2-user:ec2-user /opt/mcp-server

# Install Nginx
dnf install -y nginx
systemctl start nginx
systemctl enable nginx

# Basic Nginx configuration (will be replaced by Ansible/Certbot)
cat > /etc/nginx/conf.d/mcp-server.conf << 'NGINXEOF'
server {
    listen 80;
    server_name ${domain_name};

    location / {
        return 301 https://$server_name$request_uri;
    }

    # Allow Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}

server {
    listen 443 ssl http2;
    server_name ${domain_name};

    # Temporary self-signed cert (will be replaced by Let's Encrypt)
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE endpoint (special handling)
    location /sse {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE specific
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        chunked_transfer_encoding off;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
NGINXEOF

# Reload Nginx
systemctl reload nginx

# Create systemd service for MCP server
cat > /etc/systemd/system/mcp-server.service << 'SERVICEEOF'
[Unit]
Description=Unified MCP Server
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/mcp-server
EnvironmentFile=/opt/mcp-server/.env
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Wait for Docker to be ready
ExecStartPre=/bin/sleep 5

# Pull or build image (customize based on your deployment strategy)
# Option 1: Pull from registry
# ExecStartPre=-/usr/local/bin/docker-compose pull

# Option 2: Or use pre-built image
ExecStartPre=-/usr/bin/docker pull YOUR_REGISTRY/unified-mcp-server:latest

# Start the service
ExecStart=/usr/local/bin/docker-compose up

# Stop the service
ExecStop=/usr/local/bin/docker-compose down

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Note: Actual Docker startup will be handled by Ansible after deployment
# This is just the service definition

# Signal completion
touch /var/log/user-data-complete
echo "User data script completed at $(date)" >> /var/log/user-data-complete

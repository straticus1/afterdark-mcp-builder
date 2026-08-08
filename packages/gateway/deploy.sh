#!/bin/bash
set -e

#######################################
# Unified MCP Server - AWS Deployment Script
# Deploys to AWS using Terraform + Ansible
#######################################

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Unified MCP Server - AWS Deployment${NC}"
echo -e "${GREEN}======================================${NC}"

# Check for required tools
check_requirements() {
    echo -e "\n${YELLOW}Checking requirements...${NC}"

    command -v terraform >/dev/null 2>&1 || {
        echo -e "${RED}Error: terraform is required but not installed.${NC}"
        echo "Install from: https://www.terraform.io/downloads"
        exit 1
    }

    command -v ansible >/dev/null 2>&1 || {
        echo -e "${RED}Error: ansible is required but not installed.${NC}"
        echo "Install with: pip install ansible"
        exit 1
    }

    command -v aws >/dev/null 2>&1 || {
        echo -e "${RED}Error: AWS CLI is required but not installed.${NC}"
        echo "Install from: https://aws.amazon.com/cli/"
        exit 1
    }

    echo -e "${GREEN}✓ All requirements met${NC}"
}

# Check environment variables
check_env() {
    echo -e "\n${YELLOW}Checking environment variables...${NC}"

    if [ -z "$MCP_API_KEY" ]; then
        echo -e "${RED}Error: MCP_API_KEY environment variable is not set${NC}"
        echo "Set it with: export MCP_API_KEY=your-secret-key"
        exit 1
    fi

    if [ -z "$LETSENCRYPT_EMAIL" ]; then
        echo -e "${YELLOW}Warning: LETSENCRYPT_EMAIL not set, using default${NC}"
        export LETSENCRYPT_EMAIL="admin@afterdarksys.com"
    fi

    echo -e "${GREEN}✓ Environment variables OK${NC}"
}

# Deploy infrastructure with Terraform
deploy_infrastructure() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Step 1: Deploying AWS Infrastructure${NC}"
    echo -e "${GREEN}========================================${NC}"

    cd terraform

    # Initialize Terraform
    echo -e "\n${YELLOW}Initializing Terraform...${NC}"
    terraform init

    # Validate configuration
    echo -e "\n${YELLOW}Validating Terraform configuration...${NC}"
    terraform validate

    # Plan deployment
    echo -e "\n${YELLOW}Planning deployment...${NC}"
    terraform plan -out=tfplan

    # Apply (ask for confirmation)
    echo -e "\n${YELLOW}Ready to deploy. This will create AWS resources.${NC}"
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo -e "${RED}Deployment cancelled${NC}"
        exit 0
    fi

    echo -e "\n${YELLOW}Applying Terraform configuration...${NC}"
    terraform apply tfplan

    # Get outputs
    export MCP_SERVER_IP=$(terraform output -raw instance_public_ip)
    export INSTANCE_ID=$(terraform output -raw instance_id)

    echo -e "\n${GREEN}✓ Infrastructure deployed${NC}"
    echo -e "${GREEN}Instance ID: ${INSTANCE_ID}${NC}"
    echo -e "${GREEN}Public IP: ${MCP_SERVER_IP}${NC}"

    cd ..
}

# Wait for instance to be ready
wait_for_instance() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Step 2: Waiting for Instance${NC}"
    echo -e "${GREEN}========================================${NC}"

    echo -e "\n${YELLOW}Waiting for instance to be ready (this may take 2-3 minutes)...${NC}"

    # Wait for SSH to be available
    max_attempts=30
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ec2-user@$MCP_SERVER_IP "echo 'SSH ready'" 2>/dev/null; then
            echo -e "${GREEN}✓ Instance is ready${NC}"
            break
        fi

        attempt=$((attempt+1))
        echo -n "."
        sleep 10
    done

    if [ $attempt -eq $max_attempts ]; then
        echo -e "\n${RED}Error: Instance did not become ready in time${NC}"
        exit 1
    fi
}

# Build and push Docker image
build_and_push_image() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Step 3: Building Docker Image${NC}"
    echo -e "${GREEN}========================================${NC}"

    echo -e "\n${YELLOW}Building Docker image...${NC}"
    docker build -t unified-mcp-server:latest .

    # Option 1: Save and copy to server
    echo -e "\n${YELLOW}Saving Docker image...${NC}"
    docker save unified-mcp-server:latest | gzip > /tmp/unified-mcp-server.tar.gz

    echo -e "\n${YELLOW}Copying image to server...${NC}"
    scp -o StrictHostKeyChecking=no /tmp/unified-mcp-server.tar.gz ec2-user@$MCP_SERVER_IP:/tmp/

    echo -e "\n${YELLOW}Loading image on server...${NC}"
    ssh -o StrictHostKeyChecking=no ec2-user@$MCP_SERVER_IP "docker load < /tmp/unified-mcp-server.tar.gz"

    # Cleanup
    rm /tmp/unified-mcp-server.tar.gz

    echo -e "${GREEN}✓ Docker image deployed${NC}"
}

# Configure server with Ansible
configure_server() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Step 4: Configuring Server${NC}"
    echo -e "${GREEN}========================================${NC}"

    cd ansible

    # Run Ansible playbook
    echo -e "\n${YELLOW}Running Ansible playbook...${NC}"
    ansible-playbook -i inventory.yml playbook.yml \
        -e "domain_name=${DOMAIN_NAME:-mcp.afterdarksys.com}" \
        -e "api_key=${MCP_API_KEY}" \
        -e "letsencrypt_email=${LETSENCRYPT_EMAIL}"

    echo -e "${GREEN}✓ Server configured${NC}"

    cd ..
}

# Test deployment
test_deployment() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Step 5: Testing Deployment${NC}"
    echo -e "${GREEN}========================================${NC}"

    DOMAIN=${DOMAIN_NAME:-mcp.afterdarksys.com}

    echo -e "\n${YELLOW}Testing HTTP redirect...${NC}"
    if curl -s -o /dev/null -w "%{http_code}" http://${DOMAIN}/health | grep -q "301\|302"; then
        echo -e "${GREEN}✓ HTTP redirects to HTTPS${NC}"
    else
        echo -e "${YELLOW}⚠ HTTP redirect not working yet (may need DNS propagation)${NC}"
    fi

    echo -e "\n${YELLOW}Testing HTTPS health endpoint...${NC}"
    if curl -k -s https://${DOMAIN}/health | grep -q "healthy"; then
        echo -e "${GREEN}✓ HTTPS health check passed${NC}"
    else
        echo -e "${YELLOW}⚠ HTTPS not ready yet (may need DNS propagation)${NC}"
    fi

    echo -e "\n${YELLOW}Testing direct IP access...${NC}"
    if curl -s http://${MCP_SERVER_IP}:3000/health | grep -q "healthy"; then
        echo -e "${GREEN}✓ Direct IP access working${NC}"
    else
        echo -e "${RED}✗ Direct IP access failed${NC}"
    fi
}

# Display summary
display_summary() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"

    DOMAIN=${DOMAIN_NAME:-mcp.afterdarksys.com}

    echo -e "\n${GREEN}Server Information:${NC}"
    echo -e "  Instance ID: ${INSTANCE_ID}"
    echo -e "  Public IP: ${MCP_SERVER_IP}"
    echo -e "  Domain: ${DOMAIN}"

    echo -e "\n${GREEN}Endpoints:${NC}"
    echo -e "  Web UI: https://${DOMAIN}"
    echo -e "  Health: https://${DOMAIN}/health"
    echo -e "  Metrics: https://${DOMAIN}/metrics"
    echo -e "  SSE: https://${DOMAIN}/sse"
    echo -e "  Config: https://${DOMAIN}/api/mcp/config"

    echo -e "\n${GREEN}SSH Access:${NC}"
    echo -e "  ssh -i ~/.ssh/mcp-server-key.pem ec2-user@${MCP_SERVER_IP}"

    echo -e "\n${GREEN}Claude Desktop Configuration:${NC}"
    echo -e "  Download from: https://${DOMAIN}/download/mcp_servers.json"
    echo -e "  Or use SSE endpoint: https://${DOMAIN}/sse"

    echo -e "\n${GREEN}Next Steps:${NC}"
    echo -e "  1. Update DNS to point ${DOMAIN} to ${MCP_SERVER_IP}"
    echo -e "  2. Wait for DNS propagation (5-30 minutes)"
    echo -e "  3. SSL certificate will be automatically obtained by Let's Encrypt"
    echo -e "  4. Configure Claude Desktop with the SSE endpoint"

    echo -e "\n${YELLOW}Important Notes:${NC}"
    echo -e "  • HTTP automatically redirects to HTTPS"
    echo -e "  • Monthly cost: ~$3-5 (t4g.nano instance)"
    echo -e "  • API Key: Set via MCP_API_KEY environment variable"
    echo -e "  • Logs: ssh to server and run 'journalctl -u mcp-server -f'"
}

# Main deployment flow
main() {
    check_requirements
    check_env
    deploy_infrastructure
    wait_for_instance
    build_and_push_image
    configure_server
    test_deployment
    display_summary

    echo -e "\n${GREEN}🎉 Deployment successful!${NC}\n"
}

# Run main
main

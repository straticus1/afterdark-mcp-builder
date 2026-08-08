import type { ServerTemplate } from "../index.js";

export const awsTemplate: ServerTemplate = {
  name: "aws",
  description: "AWS — S3, ECS, Lambda, CloudWatch, IAM (read-safe subset)",
  tags: ["cloud", "devops", "infra"],
  command: "npx",
  args: ["-y", "mcp-server-aws"],
  env: { AWS_PROFILE: "${AWS_PROFILE}", AWS_REGION: "${AWS_REGION}" },
  config: { profile: "${AWS_PROFILE}", region: "${AWS_REGION}" },
  envVars: [
    { key: "AWS_PROFILE", description: "AWS CLI profile name", example: "default" },
    { key: "AWS_REGION", description: "Default AWS region", example: "us-east-1" },
  ],
  health: { command: "aws sts get-caller-identity --profile ${AWS_PROFILE} --region ${AWS_REGION}", timeout: 10000 },
  install: "npm install -g mcp-server-aws",
  docs: "https://github.com/modelcontextprotocol/servers",
};

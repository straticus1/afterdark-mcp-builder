// AWS Module - Amazon Web Services CLI integration
// Uses AWS CLI (aws) for cloud infrastructure management

import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../shared/utils.js';

const execAsync = promisify(exec);
const logger = new Logger('aws');

interface AWSConfig {
  region?: string;
  profile?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class AWSModule {
  private config: AWSConfig;

  constructor(config: AWSConfig = {}) {
    this.config = {
      region: config.region || process.env['AWS_REGION'] || process.env['AWS_DEFAULT_REGION'] || 'us-east-1',
      profile: config.profile || process.env['AWS_PROFILE'],
      accessKeyId: config.accessKeyId || process.env['AWS_ACCESS_KEY_ID'],
      secretAccessKey: config.secretAccessKey || process.env['AWS_SECRET_ACCESS_KEY'],
    };

    if (!this.config.accessKeyId && !this.config.profile) {
      logger.warn('AWS credentials not configured - some features may be limited');
    }
  }

  getTools() {
    return [
      {
        name: 'list_ec2_instances',
        description: 'List EC2 instances with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            filters: { type: 'string', description: 'Filter expression (e.g., "Name=instance-state-name,Values=running")' },
            region: { type: 'string', description: 'AWS region override' },
          },
        },
      },
      {
        name: 'describe_ec2_instance',
        description: 'Get detailed information about an EC2 instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'EC2 instance ID' },
          },
          required: ['instanceId'],
        },
      },
      {
        name: 'start_ec2_instance',
        description: 'Start an EC2 instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'EC2 instance ID' },
          },
          required: ['instanceId'],
        },
      },
      {
        name: 'stop_ec2_instance',
        description: 'Stop an EC2 instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'EC2 instance ID' },
          },
          required: ['instanceId'],
        },
      },
      {
        name: 'list_s3_buckets',
        description: 'List all S3 buckets',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_s3_objects',
        description: 'List objects in an S3 bucket',
        inputSchema: {
          type: 'object',
          properties: {
            bucket: { type: 'string', description: 'S3 bucket name' },
            prefix: { type: 'string', description: 'Object prefix filter' },
            maxItems: { type: 'number', description: 'Maximum number of items to return' },
          },
          required: ['bucket'],
        },
      },
      {
        name: 'list_rds_instances',
        description: 'List RDS database instances',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string', description: 'AWS region override' },
          },
        },
      },
      {
        name: 'list_lambda_functions',
        description: 'List Lambda functions',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string', description: 'AWS region override' },
          },
        },
      },
      {
        name: 'invoke_lambda',
        description: 'Invoke a Lambda function',
        inputSchema: {
          type: 'object',
          properties: {
            functionName: { type: 'string', description: 'Lambda function name or ARN' },
            payload: { type: 'string', description: 'JSON payload to send' },
          },
          required: ['functionName'],
        },
      },
      {
        name: 'list_ecs_clusters',
        description: 'List ECS clusters',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string', description: 'AWS region override' },
          },
        },
      },
      {
        name: 'list_ecs_services',
        description: 'List ECS services in a cluster',
        inputSchema: {
          type: 'object',
          properties: {
            cluster: { type: 'string', description: 'ECS cluster name or ARN' },
          },
          required: ['cluster'],
        },
      },
      {
        name: 'get_caller_identity',
        description: 'Get AWS account and user identity information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_route53_zones',
        description: 'List Route53 hosted zones',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_cloudwatch_alarms',
        description: 'List CloudWatch alarms',
        inputSchema: {
          type: 'object',
          properties: {
            stateValue: { type: 'string', description: 'Filter by alarm state (OK, ALARM, INSUFFICIENT_DATA)' },
          },
        },
      },
    ];
  }

  private async runAWSCommand(command: string, region?: string): Promise<any> {
    const regionFlag = region || this.config.region ? `--region ${region || this.config.region}` : '';
    const profileFlag = this.config.profile ? `--profile ${this.config.profile}` : '';
    const fullCommand = `aws ${command} ${regionFlag} ${profileFlag} --output json`;

    logger.debug(`Executing: ${fullCommand}`);

    try {
      const { stdout, stderr } = await execAsync(fullCommand, { timeout: 60000 });
      if (stderr) logger.debug(`AWS stderr: ${stderr}`);
      return JSON.parse(stdout);
    } catch (error: any) {
      logger.error(`AWS command failed: ${error.message}`);
      throw new Error(`AWS command failed: ${error.message}`);
    }
  }

  async handleTool(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case 'list_ec2_instances': {
        const filterArg = args['filters'] ? `--filters "${args['filters']}"` : '';
        return this.runAWSCommand(`ec2 describe-instances ${filterArg}`, args['region']);
      }

      case 'describe_ec2_instance':
        return this.runAWSCommand(`ec2 describe-instances --instance-ids ${args['instanceId']}`);

      case 'start_ec2_instance':
        return this.runAWSCommand(`ec2 start-instances --instance-ids ${args['instanceId']}`);

      case 'stop_ec2_instance':
        return this.runAWSCommand(`ec2 stop-instances --instance-ids ${args['instanceId']}`);

      case 'list_s3_buckets':
        return this.runAWSCommand('s3api list-buckets');

      case 'list_s3_objects': {
        const prefixArg = args['prefix'] ? `--prefix "${args['prefix']}"` : '';
        const maxArg = args['maxItems'] ? `--max-items ${args['maxItems']}` : '';
        return this.runAWSCommand(`s3api list-objects-v2 --bucket ${args['bucket']} ${prefixArg} ${maxArg}`);
      }

      case 'list_rds_instances':
        return this.runAWSCommand('rds describe-db-instances', args['region']);

      case 'list_lambda_functions':
        return this.runAWSCommand('lambda list-functions', args['region']);

      case 'invoke_lambda': {
        const payloadArg = args['payload'] ? `--payload '${args['payload']}'` : '';
        return this.runAWSCommand(`lambda invoke --function-name ${args['functionName']} ${payloadArg} /dev/stdout`);
      }

      case 'list_ecs_clusters':
        return this.runAWSCommand('ecs list-clusters', args['region']);

      case 'list_ecs_services':
        return this.runAWSCommand(`ecs list-services --cluster ${args['cluster']}`);

      case 'get_caller_identity':
        return this.runAWSCommand('sts get-caller-identity');

      case 'list_route53_zones':
        return this.runAWSCommand('route53 list-hosted-zones');

      case 'list_cloudwatch_alarms': {
        const stateArg = args['stateValue'] ? `--state-value ${args['stateValue']}` : '';
        return this.runAWSCommand(`cloudwatch describe-alarms ${stateArg}`);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

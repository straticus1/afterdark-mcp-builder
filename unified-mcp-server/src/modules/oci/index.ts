/**
 * OCI (Oracle Cloud Infrastructure) Module
 * Provides tools for managing OCI resources
 */

import { Logger } from '../../shared/utils.js';

const logger = new Logger('oci');

export interface OCIConfig {
  configFilePath?: string;
  profile?: string;
  tenancyId?: string;
  userId?: string;
  fingerprint?: string;
  privateKey?: string;
  region?: string;
}

interface OCIClient {
  tenancyId: string;
  region: string;
  configured: boolean;
}

export class OCIModule {
  private client: OCIClient;
  private config: OCIConfig;

  constructor(config: OCIConfig = {}) {
    this.config = config;
    this.client = {
      tenancyId: config.tenancyId || process.env['OCI_TENANCY_ID'] || '',
      region: config.region || process.env['OCI_REGION'] || 'us-ashburn-1',
      configured: !!(config.tenancyId || process.env['OCI_TENANCY_ID']),
    };

    if (this.client.configured) {
      logger.info(`OCI module initialized for region: ${this.client.region}`);
    } else {
      logger.warn('OCI credentials not configured - some features may be limited');
    }
  }

  getTools() {
    return [
      // Compute Tools
      {
        name: 'list_instances',
        description: 'List all compute instances in a compartment',
        inputSchema: {
          type: 'object',
          properties: {
            compartmentId: { type: 'string', description: 'Compartment OCID' },
            limit: { type: 'number', description: 'Maximum number of instances to return' },
          },
          required: ['compartmentId'],
        },
      },
      {
        name: 'get_instance',
        description: 'Get details of a specific compute instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Instance OCID' },
          },
          required: ['instanceId'],
        },
      },
      {
        name: 'start_instance',
        description: 'Start a stopped compute instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Instance OCID' },
          },
          required: ['instanceId'],
        },
      },
      {
        name: 'stop_instance',
        description: 'Stop a running compute instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: { type: 'string', description: 'Instance OCID' },
          },
          required: ['instanceId'],
        },
      },
      // Networking Tools
      {
        name: 'list_vcns',
        description: 'List all VCNs (Virtual Cloud Networks) in a compartment',
        inputSchema: {
          type: 'object',
          properties: {
            compartmentId: { type: 'string', description: 'Compartment OCID' },
          },
          required: ['compartmentId'],
        },
      },
      {
        name: 'list_subnets',
        description: 'List all subnets in a VCN',
        inputSchema: {
          type: 'object',
          properties: {
            compartmentId: { type: 'string', description: 'Compartment OCID' },
            vcnId: { type: 'string', description: 'VCN OCID' },
          },
          required: ['compartmentId', 'vcnId'],
        },
      },
      // Load Balancer Tools
      {
        name: 'list_load_balancers',
        description: 'List all load balancers in a compartment',
        inputSchema: {
          type: 'object',
          properties: {
            compartmentId: { type: 'string', description: 'Compartment OCID' },
          },
          required: ['compartmentId'],
        },
      },
      {
        name: 'get_load_balancer_health',
        description: 'Get health status of a load balancer',
        inputSchema: {
          type: 'object',
          properties: {
            loadBalancerId: { type: 'string', description: 'Load Balancer OCID' },
          },
          required: ['loadBalancerId'],
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    logger.debug(`Handling OCI tool: ${name}`, args);

    if (!this.client.configured) {
      return {
        error: 'OCI not configured',
        message: 'Please configure OCI credentials via environment variables or config file',
        requiredEnvVars: ['OCI_TENANCY_ID', 'OCI_USER_ID', 'OCI_FINGERPRINT', 'OCI_PRIVATE_KEY', 'OCI_REGION'],
      };
    }

    try {
      switch (name) {
        case 'list_instances':
          return await this.listInstances(args.compartmentId, args.limit);
        case 'get_instance':
          return await this.getInstance(args.instanceId);
        case 'start_instance':
          return await this.startInstance(args.instanceId);
        case 'stop_instance':
          return await this.stopInstance(args.instanceId);
        case 'list_vcns':
          return await this.listVCNs(args.compartmentId);
        case 'list_subnets':
          return await this.listSubnets(args.compartmentId, args.vcnId);
        case 'list_load_balancers':
          return await this.listLoadBalancers(args.compartmentId);
        case 'get_load_balancer_health':
          return await this.getLoadBalancerHealth(args.loadBalancerId);
        default:
          throw new Error(`Unknown OCI tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error in OCI ${name}:`, error);
      throw error;
    }
  }

  private async executeOCICommand(args: string[]): Promise<any> {
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const oci = spawn('oci', args, {
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      oci.stdout.on('data', (data) => { stdout += data.toString(); });
      oci.stderr.on('data', (data) => { stderr += data.toString(); });

      oci.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ output: stdout });
          }
        } else {
          reject(new Error(stderr || `OCI command failed with code ${code}`));
        }
      });

      oci.on('error', (err) => {
        reject(new Error(`Failed to execute OCI CLI: ${err.message}`));
      });
    });
  }

  private async listInstances(compartmentId: string, limit?: number): Promise<any> {
    const args = ['compute', 'instance', 'list', '--compartment-id', compartmentId, '--output', 'json'];
    if (limit) args.push('--limit', limit.toString());
    return await this.executeOCICommand(args);
  }

  private async getInstance(instanceId: string): Promise<any> {
    return await this.executeOCICommand(['compute', 'instance', 'get', '--instance-id', instanceId, '--output', 'json']);
  }

  private async startInstance(instanceId: string): Promise<any> {
    return await this.executeOCICommand(['compute', 'instance', 'action', '--action', 'START', '--instance-id', instanceId, '--output', 'json']);
  }

  private async stopInstance(instanceId: string): Promise<any> {
    return await this.executeOCICommand(['compute', 'instance', 'action', '--action', 'STOP', '--instance-id', instanceId, '--output', 'json']);
  }

  private async listVCNs(compartmentId: string): Promise<any> {
    return await this.executeOCICommand(['network', 'vcn', 'list', '--compartment-id', compartmentId, '--output', 'json']);
  }

  private async listSubnets(compartmentId: string, vcnId: string): Promise<any> {
    return await this.executeOCICommand(['network', 'subnet', 'list', '--compartment-id', compartmentId, '--vcn-id', vcnId, '--output', 'json']);
  }

  private async listLoadBalancers(compartmentId: string): Promise<any> {
    return await this.executeOCICommand(['lb', 'load-balancer', 'list', '--compartment-id', compartmentId, '--output', 'json']);
  }

  private async getLoadBalancerHealth(loadBalancerId: string): Promise<any> {
    return await this.executeOCICommand(['lb', 'load-balancer-health', 'get', '--load-balancer-id', loadBalancerId, '--output', 'json']);
  }
}

// DigitalOcean Module - DigitalOcean CLI integration
// Uses doctl CLI for cloud infrastructure management

import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../shared/utils.js';

const execAsync = promisify(exec);
const logger = new Logger('digitalocean');

interface DOConfig {
  accessToken?: string;
}

export class DigitalOceanModule {
  private config: DOConfig;

  constructor(config: DOConfig = {}) {
    this.config = {
      accessToken: config.accessToken || process.env['DIGITALOCEAN_ACCESS_TOKEN'] || process.env['DO_ACCESS_TOKEN'],
    };

    if (!this.config.accessToken) {
      logger.warn('DigitalOcean access token not configured - some features may be limited');
    }
  }

  getTools() {
    return [
      {
        name: 'list_droplets',
        description: 'List all Droplets (virtual machines)',
        inputSchema: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Filter by tag' },
          },
        },
      },
      {
        name: 'get_droplet',
        description: 'Get detailed information about a Droplet',
        inputSchema: {
          type: 'object',
          properties: {
            dropletId: { type: 'string', description: 'Droplet ID' },
          },
          required: ['dropletId'],
        },
      },
      {
        name: 'power_on_droplet',
        description: 'Power on a Droplet',
        inputSchema: {
          type: 'object',
          properties: {
            dropletId: { type: 'string', description: 'Droplet ID' },
          },
          required: ['dropletId'],
        },
      },
      {
        name: 'power_off_droplet',
        description: 'Power off a Droplet',
        inputSchema: {
          type: 'object',
          properties: {
            dropletId: { type: 'string', description: 'Droplet ID' },
          },
          required: ['dropletId'],
        },
      },
      {
        name: 'list_databases',
        description: 'List managed databases',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_kubernetes_clusters',
        description: 'List Kubernetes clusters',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_apps',
        description: 'List App Platform applications',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_domains',
        description: 'List DNS domains',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_domain_records',
        description: 'List DNS records for a domain',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'Domain name' },
          },
          required: ['domain'],
        },
      },
      {
        name: 'list_volumes',
        description: 'List block storage volumes',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_spaces',
        description: 'List Spaces (object storage buckets)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_load_balancers',
        description: 'List load balancers',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_firewalls',
        description: 'List cloud firewalls',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'account_info',
        description: 'Get account information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  private async runDoctlCommand(command: string): Promise<any> {
    const tokenArg = this.config.accessToken ? `--access-token ${this.config.accessToken}` : '';
    const fullCommand = `doctl ${command} ${tokenArg} --output json`;

    logger.debug(`Executing: doctl ${command} --output json`);

    try {
      const { stdout, stderr } = await execAsync(fullCommand, { timeout: 60000 });
      if (stderr) logger.debug(`doctl stderr: ${stderr}`);
      return JSON.parse(stdout || '[]');
    } catch (error: any) {
      logger.error(`doctl command failed: ${error.message}`);
      throw new Error(`doctl command failed: ${error.message}`);
    }
  }

  async handleTool(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case 'list_droplets': {
        const tagArg = args['tag'] ? `--tag-name ${args['tag']}` : '';
        return this.runDoctlCommand(`compute droplet list ${tagArg}`);
      }

      case 'get_droplet':
        return this.runDoctlCommand(`compute droplet get ${args['dropletId']}`);

      case 'power_on_droplet':
        return this.runDoctlCommand(`compute droplet-action power-on ${args['dropletId']}`);

      case 'power_off_droplet':
        return this.runDoctlCommand(`compute droplet-action power-off ${args['dropletId']}`);

      case 'list_databases':
        return this.runDoctlCommand('databases list');

      case 'list_kubernetes_clusters':
        return this.runDoctlCommand('kubernetes cluster list');

      case 'list_apps':
        return this.runDoctlCommand('apps list');

      case 'list_domains':
        return this.runDoctlCommand('compute domain list');

      case 'list_domain_records':
        return this.runDoctlCommand(`compute domain records list ${args['domain']}`);

      case 'list_volumes':
        return this.runDoctlCommand('compute volume list');

      case 'list_spaces':
        return this.runDoctlCommand('compute cdn list'); // Spaces accessed via CDN/API

      case 'list_load_balancers':
        return this.runDoctlCommand('compute load-balancer list');

      case 'list_firewalls':
        return this.runDoctlCommand('compute firewall list');

      case 'account_info':
        return this.runDoctlCommand('account get');

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

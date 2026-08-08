// Azure Module - Microsoft Azure CLI integration
// Uses az CLI for cloud infrastructure management

import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../shared/utils.js';

const execAsync = promisify(exec);
const logger = new Logger('azure');

interface AzureConfig {
  subscriptionId?: string;
  resourceGroup?: string;
  location?: string;
}

export class AzureModule {
  private config: AzureConfig;

  constructor(config: AzureConfig = {}) {
    this.config = {
      subscriptionId: config.subscriptionId || process.env['AZURE_SUBSCRIPTION_ID'],
      resourceGroup: config.resourceGroup || process.env['AZURE_RESOURCE_GROUP'],
      location: config.location || process.env['AZURE_LOCATION'] || 'eastus',
    };

    if (!this.config.subscriptionId) {
      logger.warn('Azure subscription not configured - some features may be limited');
    }
  }

  getTools() {
    return [
      {
        name: 'list_vms',
        description: 'List Azure Virtual Machines',
        inputSchema: {
          type: 'object',
          properties: {
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
        },
      },
      {
        name: 'show_vm',
        description: 'Get detailed information about a VM',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'VM name' },
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
          required: ['name', 'resourceGroup'],
        },
      },
      {
        name: 'start_vm',
        description: 'Start a Virtual Machine',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'VM name' },
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
          required: ['name', 'resourceGroup'],
        },
      },
      {
        name: 'stop_vm',
        description: 'Stop (deallocate) a Virtual Machine',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'VM name' },
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
          required: ['name', 'resourceGroup'],
        },
      },
      {
        name: 'list_storage_accounts',
        description: 'List Azure Storage accounts',
        inputSchema: {
          type: 'object',
          properties: {
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
        },
      },
      {
        name: 'list_storage_containers',
        description: 'List containers in a storage account',
        inputSchema: {
          type: 'object',
          properties: {
            accountName: { type: 'string', description: 'Storage account name' },
          },
          required: ['accountName'],
        },
      },
      {
        name: 'list_sql_servers',
        description: 'List Azure SQL servers',
        inputSchema: {
          type: 'object',
          properties: {
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
        },
      },
      {
        name: 'list_functions',
        description: 'List Azure Functions apps',
        inputSchema: {
          type: 'object',
          properties: {
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
        },
      },
      {
        name: 'list_aks_clusters',
        description: 'List AKS Kubernetes clusters',
        inputSchema: {
          type: 'object',
          properties: {
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
        },
      },
      {
        name: 'list_resource_groups',
        description: 'List all resource groups',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_dns_zones',
        description: 'List Azure DNS zones',
        inputSchema: {
          type: 'object',
          properties: {
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
        },
      },
      {
        name: 'show_account',
        description: 'Show current Azure account/subscription info',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_webapp',
        description: 'List Azure Web Apps',
        inputSchema: {
          type: 'object',
          properties: {
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
        },
      },
      {
        name: 'list_container_registries',
        description: 'List Azure Container Registries',
        inputSchema: {
          type: 'object',
          properties: {
            resourceGroup: { type: 'string', description: 'Resource group name' },
          },
        },
      },
    ];
  }

  private async runAzCommand(command: string): Promise<any> {
    const subscriptionFlag = this.config.subscriptionId ? `--subscription ${this.config.subscriptionId}` : '';
    const fullCommand = `az ${command} ${subscriptionFlag} --output json`;

    logger.debug(`Executing: ${fullCommand}`);

    try {
      const { stdout, stderr } = await execAsync(fullCommand, { timeout: 60000 });
      if (stderr && !stderr.includes('WARNING')) logger.debug(`az stderr: ${stderr}`);
      return JSON.parse(stdout || '[]');
    } catch (error: any) {
      logger.error(`az command failed: ${error.message}`);
      throw new Error(`az command failed: ${error.message}`);
    }
  }

  async handleTool(name: string, args: Record<string, any>): Promise<any> {
    const resourceGroup = args['resourceGroup'] || this.config.resourceGroup;
    const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : '';

    switch (name) {
      case 'list_vms':
        return this.runAzCommand(`vm list ${rgArg}`);

      case 'show_vm':
        return this.runAzCommand(`vm show --name ${args['name']} --resource-group ${args['resourceGroup']}`);

      case 'start_vm':
        return this.runAzCommand(`vm start --name ${args['name']} --resource-group ${args['resourceGroup']}`);

      case 'stop_vm':
        return this.runAzCommand(`vm deallocate --name ${args['name']} --resource-group ${args['resourceGroup']}`);

      case 'list_storage_accounts':
        return this.runAzCommand(`storage account list ${rgArg}`);

      case 'list_storage_containers':
        return this.runAzCommand(`storage container list --account-name ${args['accountName']}`);

      case 'list_sql_servers':
        return this.runAzCommand(`sql server list ${rgArg}`);

      case 'list_functions':
        return this.runAzCommand(`functionapp list ${rgArg}`);

      case 'list_aks_clusters':
        return this.runAzCommand(`aks list ${rgArg}`);

      case 'list_resource_groups':
        return this.runAzCommand('group list');

      case 'list_dns_zones':
        return this.runAzCommand(`network dns zone list ${rgArg}`);

      case 'show_account':
        return this.runAzCommand('account show');

      case 'list_webapp':
        return this.runAzCommand(`webapp list ${rgArg}`);

      case 'list_container_registries':
        return this.runAzCommand(`acr list ${rgArg}`);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

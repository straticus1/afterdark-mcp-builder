// GCP Module - Google Cloud Platform CLI integration
// Uses gcloud CLI for cloud infrastructure management

import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../shared/utils.js';

const execAsync = promisify(exec);
const logger = new Logger('gcp');

interface GCPConfig {
  project?: string;
  region?: string;
  zone?: string;
}

export class GCPModule {
  private config: GCPConfig;

  constructor(config: GCPConfig = {}) {
    this.config = {
      project: config.project || process.env['GCP_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT'],
      region: config.region || process.env['GCP_REGION'] || 'us-central1',
      zone: config.zone || process.env['GCP_ZONE'] || 'us-central1-a',
    };

    if (!this.config.project) {
      logger.warn('GCP project not configured - some features may be limited');
    }
  }

  getTools() {
    return [
      {
        name: 'list_instances',
        description: 'List Compute Engine VM instances',
        inputSchema: {
          type: 'object',
          properties: {
            zone: { type: 'string', description: 'GCP zone (or use --zones for all zones)' },
            filter: { type: 'string', description: 'Filter expression' },
          },
        },
      },
      {
        name: 'describe_instance',
        description: 'Get detailed information about a Compute Engine instance',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Instance name' },
            zone: { type: 'string', description: 'Instance zone' },
          },
          required: ['name'],
        },
      },
      {
        name: 'start_instance',
        description: 'Start a Compute Engine instance',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Instance name' },
            zone: { type: 'string', description: 'Instance zone' },
          },
          required: ['name'],
        },
      },
      {
        name: 'stop_instance',
        description: 'Stop a Compute Engine instance',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Instance name' },
            zone: { type: 'string', description: 'Instance zone' },
          },
          required: ['name'],
        },
      },
      {
        name: 'list_buckets',
        description: 'List Cloud Storage buckets',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_objects',
        description: 'List objects in a Cloud Storage bucket',
        inputSchema: {
          type: 'object',
          properties: {
            bucket: { type: 'string', description: 'Bucket name' },
            prefix: { type: 'string', description: 'Object prefix filter' },
          },
          required: ['bucket'],
        },
      },
      {
        name: 'list_sql_instances',
        description: 'List Cloud SQL instances',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_functions',
        description: 'List Cloud Functions',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string', description: 'Function region' },
          },
        },
      },
      {
        name: 'call_function',
        description: 'Call a Cloud Function',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Function name' },
            region: { type: 'string', description: 'Function region' },
            data: { type: 'string', description: 'JSON data to send' },
          },
          required: ['name'],
        },
      },
      {
        name: 'list_gke_clusters',
        description: 'List GKE Kubernetes clusters',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string', description: 'Cluster region' },
          },
        },
      },
      {
        name: 'list_cloud_run_services',
        description: 'List Cloud Run services',
        inputSchema: {
          type: 'object',
          properties: {
            region: { type: 'string', description: 'Service region' },
          },
        },
      },
      {
        name: 'list_dns_zones',
        description: 'List Cloud DNS managed zones',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_project_info',
        description: 'Get current project information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_pubsub_topics',
        description: 'List Pub/Sub topics',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  private async runGCloudCommand(command: string): Promise<any> {
    const projectFlag = this.config.project ? `--project=${this.config.project}` : '';
    const fullCommand = `gcloud ${command} ${projectFlag} --format=json`;

    logger.debug(`Executing: ${fullCommand}`);

    try {
      const { stdout, stderr } = await execAsync(fullCommand, { timeout: 60000 });
      if (stderr && !stderr.includes('WARNING')) logger.debug(`gcloud stderr: ${stderr}`);
      return JSON.parse(stdout || '[]');
    } catch (error: any) {
      logger.error(`gcloud command failed: ${error.message}`);
      throw new Error(`gcloud command failed: ${error.message}`);
    }
  }

  async handleTool(name: string, args: Record<string, any>): Promise<any> {
    const zone = args['zone'] || this.config.zone;
    const region = args['region'] || this.config.region;

    switch (name) {
      case 'list_instances': {
        const zoneArg = args['zone'] ? `--zones=${args['zone']}` : '';
        const filterArg = args['filter'] ? `--filter="${args['filter']}"` : '';
        return this.runGCloudCommand(`compute instances list ${zoneArg} ${filterArg}`);
      }

      case 'describe_instance':
        return this.runGCloudCommand(`compute instances describe ${args['name']} --zone=${zone}`);

      case 'start_instance':
        return this.runGCloudCommand(`compute instances start ${args['name']} --zone=${zone}`);

      case 'stop_instance':
        return this.runGCloudCommand(`compute instances stop ${args['name']} --zone=${zone}`);

      case 'list_buckets':
        return this.runGCloudCommand('storage buckets list');

      case 'list_objects': {
        const prefixArg = args['prefix'] ? `--prefix="${args['prefix']}"` : '';
        return this.runGCloudCommand(`storage objects list gs://${args['bucket']} ${prefixArg}`);
      }

      case 'list_sql_instances':
        return this.runGCloudCommand('sql instances list');

      case 'list_functions':
        return this.runGCloudCommand(`functions list --region=${region}`);

      case 'call_function': {
        const dataArg = args['data'] ? `--data='${args['data']}'` : '';
        return this.runGCloudCommand(`functions call ${args['name']} --region=${region} ${dataArg}`);
      }

      case 'list_gke_clusters':
        return this.runGCloudCommand(`container clusters list --region=${region}`);

      case 'list_cloud_run_services':
        return this.runGCloudCommand(`run services list --region=${region}`);

      case 'list_dns_zones':
        return this.runGCloudCommand('dns managed-zones list');

      case 'get_project_info':
        return this.runGCloudCommand(`projects describe ${this.config.project}`);

      case 'list_pubsub_topics':
        return this.runGCloudCommand('pubsub topics list');

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

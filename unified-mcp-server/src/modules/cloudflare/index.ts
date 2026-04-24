/**
 * Cloudflare Module
 * Provides tools for managing Cloudflare DNS, Workers, KV, and more
 */

import { Logger } from '../../shared/utils.js';

const logger = new Logger('cloudflare');

export interface CloudflareConfig {
  apiToken?: string;
  accountId?: string;
  email?: string;
  apiKey?: string;
}

interface CloudflareClient {
  apiToken: string;
  accountId: string;
  configured: boolean;
  baseUrl: string;
}

export class CloudflareModule {
  private client: CloudflareClient;
  private config: CloudflareConfig;

  constructor(config: CloudflareConfig = {}) {
    this.config = config;
    this.client = {
      apiToken: config.apiToken || process.env['CLOUDFLARE_API_TOKEN'] || '',
      accountId: config.accountId || process.env['CLOUDFLARE_ACCOUNT_ID'] || '',
      configured: !!(config.apiToken || process.env['CLOUDFLARE_API_TOKEN']),
      baseUrl: 'https://api.cloudflare.com/client/v4',
    };

    if (this.client.configured) {
      logger.info('Cloudflare module initialized');
    } else {
      logger.warn('Cloudflare API token not configured');
    }
  }

  getTools() {
    return [
      // DNS Tools
      {
        name: 'list_zones',
        description: 'List all DNS zones in the account',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Filter by zone name' },
            status: { type: 'string', description: 'Filter by status (active, pending, etc.)' },
          },
        },
      },
      {
        name: 'list_dns_records',
        description: 'List DNS records for a zone',
        inputSchema: {
          type: 'object',
          properties: {
            zoneId: { type: 'string', description: 'Zone ID' },
            type: { type: 'string', description: 'Record type (A, AAAA, CNAME, etc.)' },
            name: { type: 'string', description: 'Record name filter' },
          },
          required: ['zoneId'],
        },
      },
      {
        name: 'create_dns_record',
        description: 'Create a new DNS record',
        inputSchema: {
          type: 'object',
          properties: {
            zoneId: { type: 'string', description: 'Zone ID' },
            type: { type: 'string', description: 'Record type (A, AAAA, CNAME, TXT, etc.)' },
            name: { type: 'string', description: 'Record name (e.g., subdomain or @)' },
            content: { type: 'string', description: 'Record content (IP address, hostname, text)' },
            ttl: { type: 'number', description: 'TTL in seconds (1 = auto)' },
            proxied: { type: 'boolean', description: 'Enable Cloudflare proxy' },
          },
          required: ['zoneId', 'type', 'name', 'content'],
        },
      },
      {
        name: 'update_dns_record',
        description: 'Update an existing DNS record',
        inputSchema: {
          type: 'object',
          properties: {
            zoneId: { type: 'string', description: 'Zone ID' },
            recordId: { type: 'string', description: 'Record ID' },
            type: { type: 'string', description: 'Record type' },
            name: { type: 'string', description: 'Record name' },
            content: { type: 'string', description: 'Record content' },
            ttl: { type: 'number', description: 'TTL in seconds' },
            proxied: { type: 'boolean', description: 'Enable Cloudflare proxy' },
          },
          required: ['zoneId', 'recordId', 'type', 'name', 'content'],
        },
      },
      {
        name: 'delete_dns_record',
        description: 'Delete a DNS record',
        inputSchema: {
          type: 'object',
          properties: {
            zoneId: { type: 'string', description: 'Zone ID' },
            recordId: { type: 'string', description: 'Record ID' },
          },
          required: ['zoneId', 'recordId'],
        },
      },
      // Workers Tools
      {
        name: 'list_workers',
        description: 'List all Workers scripts',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_worker',
        description: 'Get a Worker script details',
        inputSchema: {
          type: 'object',
          properties: {
            scriptName: { type: 'string', description: 'Worker script name' },
          },
          required: ['scriptName'],
        },
      },
      // KV Tools
      {
        name: 'list_kv_namespaces',
        description: 'List all KV namespaces',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_kv_keys',
        description: 'List keys in a KV namespace',
        inputSchema: {
          type: 'object',
          properties: {
            namespaceId: { type: 'string', description: 'KV namespace ID' },
            prefix: { type: 'string', description: 'Key prefix filter' },
            limit: { type: 'number', description: 'Maximum keys to return' },
          },
          required: ['namespaceId'],
        },
      },
      {
        name: 'get_kv_value',
        description: 'Get a value from KV',
        inputSchema: {
          type: 'object',
          properties: {
            namespaceId: { type: 'string', description: 'KV namespace ID' },
            key: { type: 'string', description: 'Key name' },
          },
          required: ['namespaceId', 'key'],
        },
      },
      {
        name: 'put_kv_value',
        description: 'Put a value in KV',
        inputSchema: {
          type: 'object',
          properties: {
            namespaceId: { type: 'string', description: 'KV namespace ID' },
            key: { type: 'string', description: 'Key name' },
            value: { type: 'string', description: 'Value to store' },
            expirationTtl: { type: 'number', description: 'TTL in seconds' },
          },
          required: ['namespaceId', 'key', 'value'],
        },
      },
      // Analytics Tools
      {
        name: 'get_zone_analytics',
        description: 'Get analytics data for a zone',
        inputSchema: {
          type: 'object',
          properties: {
            zoneId: { type: 'string', description: 'Zone ID' },
            since: { type: 'string', description: 'Start date (ISO format or relative like -1d)' },
            until: { type: 'string', description: 'End date (ISO format or relative)' },
          },
          required: ['zoneId'],
        },
      },
      // Cache Tools
      {
        name: 'purge_cache',
        description: 'Purge cache for a zone',
        inputSchema: {
          type: 'object',
          properties: {
            zoneId: { type: 'string', description: 'Zone ID' },
            purgeEverything: { type: 'boolean', description: 'Purge all cached files' },
            files: { type: 'array', items: { type: 'string' }, description: 'Specific URLs to purge' },
          },
          required: ['zoneId'],
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    logger.debug(`Handling Cloudflare tool: ${name}`, args);

    if (!this.client.configured) {
      return {
        error: 'Cloudflare not configured',
        message: 'Please set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID environment variables',
      };
    }

    try {
      switch (name) {
        case 'list_zones':
          return await this.listZones(args);
        case 'list_dns_records':
          return await this.listDNSRecords(args.zoneId, args);
        case 'create_dns_record':
          return await this.createDNSRecord(args);
        case 'update_dns_record':
          return await this.updateDNSRecord(args);
        case 'delete_dns_record':
          return await this.deleteDNSRecord(args.zoneId, args.recordId);
        case 'list_workers':
          return await this.listWorkers();
        case 'get_worker':
          return await this.getWorker(args.scriptName);
        case 'list_kv_namespaces':
          return await this.listKVNamespaces();
        case 'list_kv_keys':
          return await this.listKVKeys(args.namespaceId, args);
        case 'get_kv_value':
          return await this.getKVValue(args.namespaceId, args.key);
        case 'put_kv_value':
          return await this.putKVValue(args);
        case 'get_zone_analytics':
          return await this.getZoneAnalytics(args);
        case 'purge_cache':
          return await this.purgeCache(args);
        default:
          throw new Error(`Unknown Cloudflare tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error in Cloudflare ${name}:`, error);
      throw error;
    }
  }

  private async cfFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.client.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.client.apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.errors?.[0]?.message || `Cloudflare API error: ${response.status}`);
    }

    return data;
  }

  private async listZones(filters: any): Promise<any> {
    let endpoint = '/zones?';
    if (filters.name) endpoint += `name=${encodeURIComponent(filters.name)}&`;
    if (filters.status) endpoint += `status=${filters.status}&`;
    return await this.cfFetch(endpoint);
  }

  private async listDNSRecords(zoneId: string, filters: any): Promise<any> {
    let endpoint = `/zones/${zoneId}/dns_records?`;
    if (filters.type) endpoint += `type=${filters.type}&`;
    if (filters.name) endpoint += `name=${encodeURIComponent(filters.name)}&`;
    return await this.cfFetch(endpoint);
  }

  private async createDNSRecord(args: any): Promise<any> {
    return await this.cfFetch(`/zones/${args.zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: args.type,
        name: args.name,
        content: args.content,
        ttl: args.ttl || 1,
        proxied: args.proxied ?? false,
      }),
    });
  }

  private async updateDNSRecord(args: any): Promise<any> {
    return await this.cfFetch(`/zones/${args.zoneId}/dns_records/${args.recordId}`, {
      method: 'PUT',
      body: JSON.stringify({
        type: args.type,
        name: args.name,
        content: args.content,
        ttl: args.ttl || 1,
        proxied: args.proxied ?? false,
      }),
    });
  }

  private async deleteDNSRecord(zoneId: string, recordId: string): Promise<any> {
    return await this.cfFetch(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
    });
  }

  private async listWorkers(): Promise<any> {
    return await this.cfFetch(`/accounts/${this.client.accountId}/workers/scripts`);
  }

  private async getWorker(scriptName: string): Promise<any> {
    return await this.cfFetch(`/accounts/${this.client.accountId}/workers/scripts/${scriptName}`);
  }

  private async listKVNamespaces(): Promise<any> {
    return await this.cfFetch(`/accounts/${this.client.accountId}/storage/kv/namespaces`);
  }

  private async listKVKeys(namespaceId: string, filters: any): Promise<any> {
    let endpoint = `/accounts/${this.client.accountId}/storage/kv/namespaces/${namespaceId}/keys?`;
    if (filters.prefix) endpoint += `prefix=${encodeURIComponent(filters.prefix)}&`;
    if (filters.limit) endpoint += `limit=${filters.limit}&`;
    return await this.cfFetch(endpoint);
  }

  private async getKVValue(namespaceId: string, key: string): Promise<any> {
    const url = `${this.client.baseUrl}/accounts/${this.client.accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.client.apiToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to get KV value: ${response.status}`);
    }

    return { value: await response.text() };
  }

  private async putKVValue(args: any): Promise<any> {
    let endpoint = `/accounts/${this.client.accountId}/storage/kv/namespaces/${args.namespaceId}/values/${encodeURIComponent(args.key)}`;
    if (args.expirationTtl) endpoint += `?expiration_ttl=${args.expirationTtl}`;

    const url = `${this.client.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.client.apiToken}`,
        'Content-Type': 'text/plain',
      },
      body: args.value,
    });

    if (!response.ok) {
      throw new Error(`Failed to put KV value: ${response.status}`);
    }

    return { success: true };
  }

  private async getZoneAnalytics(args: any): Promise<any> {
    let endpoint = `/zones/${args.zoneId}/analytics/dashboard?`;
    if (args.since) endpoint += `since=${args.since}&`;
    if (args.until) endpoint += `until=${args.until}&`;
    return await this.cfFetch(endpoint);
  }

  private async purgeCache(args: any): Promise<any> {
    const body: any = {};
    if (args.purgeEverything) {
      body.purge_everything = true;
    } else if (args.files) {
      body.files = args.files;
    }

    return await this.cfFetch(`/zones/${args.zoneId}/purge_cache`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

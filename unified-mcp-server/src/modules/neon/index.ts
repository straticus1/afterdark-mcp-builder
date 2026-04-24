/**
 * Neon Module
 * Provides tools for managing Neon serverless PostgreSQL databases
 */

import { Logger } from '../../shared/utils.js';

const logger = new Logger('neon');

export interface NeonConfig {
  apiKey?: string;
}

interface NeonClient {
  apiKey: string;
  configured: boolean;
  baseUrl: string;
}

export class NeonModule {
  private client: NeonClient;
  private config: NeonConfig;

  constructor(config: NeonConfig = {}) {
    this.config = config;
    this.client = {
      apiKey: config.apiKey || process.env['NEON_API_KEY'] || '',
      configured: !!(config.apiKey || process.env['NEON_API_KEY']),
      baseUrl: 'https://console.neon.tech/api/v2',
    };

    if (this.client.configured) {
      logger.info('Neon module initialized');
    } else {
      logger.warn('Neon API key not configured');
    }
  }

  getTools() {
    return [
      // Project Tools
      {
        name: 'list_projects',
        description: 'List all Neon projects',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum number of projects to return' },
          },
        },
      },
      {
        name: 'get_project',
        description: 'Get details of a specific project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'create_project',
        description: 'Create a new Neon project',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project name' },
            regionId: { type: 'string', description: 'Region ID (e.g., aws-us-east-1)' },
            pgVersion: { type: 'string', description: 'PostgreSQL version (14, 15, 16)' },
          },
          required: ['name'],
        },
      },
      {
        name: 'delete_project',
        description: 'Delete a Neon project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
          },
          required: ['projectId'],
        },
      },
      // Branch Tools
      {
        name: 'list_branches',
        description: 'List all branches in a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'create_branch',
        description: 'Create a new branch from the main branch',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            name: { type: 'string', description: 'Branch name' },
            parentId: { type: 'string', description: 'Parent branch ID (optional, defaults to main)' },
          },
          required: ['projectId', 'name'],
        },
      },
      {
        name: 'delete_branch',
        description: 'Delete a branch',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            branchId: { type: 'string', description: 'Branch ID' },
          },
          required: ['projectId', 'branchId'],
        },
      },
      // Database Tools
      {
        name: 'list_databases',
        description: 'List all databases in a branch',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            branchId: { type: 'string', description: 'Branch ID' },
          },
          required: ['projectId', 'branchId'],
        },
      },
      {
        name: 'create_database',
        description: 'Create a new database in a branch',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            branchId: { type: 'string', description: 'Branch ID' },
            name: { type: 'string', description: 'Database name' },
            ownerName: { type: 'string', description: 'Database owner role name' },
          },
          required: ['projectId', 'branchId', 'name', 'ownerName'],
        },
      },
      // Endpoint (Compute) Tools
      {
        name: 'list_endpoints',
        description: 'List compute endpoints in a project',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
          },
          required: ['projectId'],
        },
      },
      {
        name: 'start_endpoint',
        description: 'Start a compute endpoint',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            endpointId: { type: 'string', description: 'Endpoint ID' },
          },
          required: ['projectId', 'endpointId'],
        },
      },
      {
        name: 'suspend_endpoint',
        description: 'Suspend a compute endpoint',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            endpointId: { type: 'string', description: 'Endpoint ID' },
          },
          required: ['projectId', 'endpointId'],
        },
      },
      // Connection String Tools
      {
        name: 'get_connection_string',
        description: 'Get the connection string for a database',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: { type: 'string', description: 'Project ID' },
            branchId: { type: 'string', description: 'Branch ID (optional, uses main if not provided)' },
            databaseName: { type: 'string', description: 'Database name' },
            roleName: { type: 'string', description: 'Role name' },
            pooled: { type: 'boolean', description: 'Use pooled connection (default: true)' },
          },
          required: ['projectId', 'databaseName', 'roleName'],
        },
      },
      // SQL Execution (via Neon SQL API)
      {
        name: 'execute_sql',
        description: 'Execute a SQL query on a Neon database',
        inputSchema: {
          type: 'object',
          properties: {
            connectionString: { type: 'string', description: 'Database connection string' },
            query: { type: 'string', description: 'SQL query to execute' },
            params: { type: 'array', items: { type: 'string' }, description: 'Query parameters' },
          },
          required: ['connectionString', 'query'],
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    logger.debug(`Handling Neon tool: ${name}`, args);

    if (!this.client.configured && name !== 'execute_sql') {
      return {
        error: 'Neon not configured',
        message: 'Please set NEON_API_KEY environment variable',
      };
    }

    try {
      switch (name) {
        case 'list_projects':
          return await this.listProjects(args.limit);
        case 'get_project':
          return await this.getProject(args.projectId);
        case 'create_project':
          return await this.createProject(args);
        case 'delete_project':
          return await this.deleteProject(args.projectId);
        case 'list_branches':
          return await this.listBranches(args.projectId);
        case 'create_branch':
          return await this.createBranch(args);
        case 'delete_branch':
          return await this.deleteBranch(args.projectId, args.branchId);
        case 'list_databases':
          return await this.listDatabases(args.projectId, args.branchId);
        case 'create_database':
          return await this.createDatabase(args);
        case 'list_endpoints':
          return await this.listEndpoints(args.projectId);
        case 'start_endpoint':
          return await this.startEndpoint(args.projectId, args.endpointId);
        case 'suspend_endpoint':
          return await this.suspendEndpoint(args.projectId, args.endpointId);
        case 'get_connection_string':
          return await this.getConnectionString(args);
        case 'execute_sql':
          return await this.executeSQL(args);
        default:
          throw new Error(`Unknown Neon tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error in Neon ${name}:`, error);
      throw error;
    }
  }

  private async neonFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.client.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.client.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Neon API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  private async listProjects(limit?: number): Promise<any> {
    let endpoint = '/projects';
    if (limit) endpoint += `?limit=${limit}`;
    return await this.neonFetch(endpoint);
  }

  private async getProject(projectId: string): Promise<any> {
    return await this.neonFetch(`/projects/${projectId}`);
  }

  private async createProject(args: any): Promise<any> {
    const body: any = {
      project: {
        name: args.name,
      },
    };
    if (args.regionId) body.project.region_id = args.regionId;
    if (args.pgVersion) body.project.pg_version = parseInt(args.pgVersion);

    return await this.neonFetch('/projects', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private async deleteProject(projectId: string): Promise<any> {
    return await this.neonFetch(`/projects/${projectId}`, { method: 'DELETE' });
  }

  private async listBranches(projectId: string): Promise<any> {
    return await this.neonFetch(`/projects/${projectId}/branches`);
  }

  private async createBranch(args: any): Promise<any> {
    const body: any = {
      branch: {
        name: args.name,
      },
    };
    if (args.parentId) body.branch.parent_id = args.parentId;

    return await this.neonFetch(`/projects/${args.projectId}/branches`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private async deleteBranch(projectId: string, branchId: string): Promise<any> {
    return await this.neonFetch(`/projects/${projectId}/branches/${branchId}`, { method: 'DELETE' });
  }

  private async listDatabases(projectId: string, branchId: string): Promise<any> {
    return await this.neonFetch(`/projects/${projectId}/branches/${branchId}/databases`);
  }

  private async createDatabase(args: any): Promise<any> {
    return await this.neonFetch(`/projects/${args.projectId}/branches/${args.branchId}/databases`, {
      method: 'POST',
      body: JSON.stringify({
        database: {
          name: args.name,
          owner_name: args.ownerName,
        },
      }),
    });
  }

  private async listEndpoints(projectId: string): Promise<any> {
    return await this.neonFetch(`/projects/${projectId}/endpoints`);
  }

  private async startEndpoint(projectId: string, endpointId: string): Promise<any> {
    return await this.neonFetch(`/projects/${projectId}/endpoints/${endpointId}/start`, {
      method: 'POST',
    });
  }

  private async suspendEndpoint(projectId: string, endpointId: string): Promise<any> {
    return await this.neonFetch(`/projects/${projectId}/endpoints/${endpointId}/suspend`, {
      method: 'POST',
    });
  }

  private async getConnectionString(args: any): Promise<any> {
    const project = await this.getProject(args.projectId);

    // Get connection info
    const endpoints = await this.listEndpoints(args.projectId);
    const endpoint = endpoints.endpoints?.[0];

    if (!endpoint) {
      throw new Error('No compute endpoint found for project');
    }

    const host = endpoint.host;
    const pooled = args.pooled !== false;
    const pooledHost = pooled ? host.replace('.', '-pooler.') : host;

    return {
      connectionString: `postgresql://${args.roleName}:[YOUR-PASSWORD]@${pooledHost}/${args.databaseName}?sslmode=require`,
      host: pooled ? pooledHost : host,
      database: args.databaseName,
      user: args.roleName,
      pooled,
      note: 'Replace [YOUR-PASSWORD] with your actual password',
    };
  }

  private async executeSQL(args: any): Promise<any> {
    // Use the @neondatabase/serverless driver pattern
    const { connectionString, query, params } = args;

    // Parse connection string to get components
    const url = new URL(connectionString);
    const host = url.hostname;
    const database = url.pathname.slice(1);
    const user = url.username;
    const password = url.password;

    // Execute via Neon HTTP API
    const sqlApiUrl = `https://${host}/sql`;

    const response = await fetch(sqlApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': connectionString,
      },
      body: JSON.stringify({
        query,
        params: params || [],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SQL execution error: ${error}`);
    }

    return await response.json();
  }
}

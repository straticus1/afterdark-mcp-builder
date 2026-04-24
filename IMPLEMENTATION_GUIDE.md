# MCP Gateway Implementation Guide
## Technical Implementation Details for After Dark Systems

---

## 1. Gateway Service Implementation

### 1.1 Core Gateway Server

```typescript
// src/gateway/server.ts

import express, { Express } from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';

import { OAuthMiddleware } from './auth/oauth-middleware';
import { TierValidator } from './auth/tier-validator';
import { ModuleRouter } from './routing/module-router';
import { MetricsCollector } from './monitoring/metrics';
import { Logger } from '../shared/logger';

interface GatewayConfig {
  port: number;
  host: string;
  oauth: {
    issuer: string;
    clientId: string;
    clientSecret: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  modules: {
    core: boolean;
    cloud: boolean;
    database: boolean;
    communication: boolean;
    developer: boolean;
  };
}

export class MCPGateway {
  private app: Express;
  private mcpServer: Server;
  private moduleRouter: ModuleRouter;
  private metrics: MetricsCollector;
  private logger: Logger;
  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    this.config = config;
    this.app = express();
    this.logger = new Logger('mcp-gateway');
    this.metrics = new MetricsCollector();
    this.moduleRouter = new ModuleRouter(config.modules);
    this.mcpServer = new Server(
      {
        name: 'afterdark-mcp-gateway',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      }
    );

    this.setupMiddleware();
    this.setupMCPHandlers();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: [
        'https://n8nworkflo.ws',
        'https://afterdarksys.com',
        'http://localhost:3000',
      ],
      credentials: true,
    }));

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });

    // OAuth authentication
    const oauthMiddleware = new OAuthMiddleware(this.config.oauth);
    this.app.use('/mcp', oauthMiddleware.authenticate.bind(oauthMiddleware));

    // Tier validation
    const tierValidator = new TierValidator();
    this.app.use('/mcp', tierValidator.validate.bind(tierValidator));

    // Metrics collection
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.metrics.recordRequest(req.method, req.path, res.statusCode, duration);
      });
      next();
    });
  }

  private setupMCPHandlers(): void {
    // List all available tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async (request) => {
      this.logger.debug('Listing tools', { user: request.params?._meta?.userId });

      // Get user tier from request metadata
      const userTier = request.params?._meta?.tier || 'free';

      // Get all tools from all modules
      const allTools = await this.moduleRouter.getAllTools();

      // Filter tools based on user tier
      const filteredTools = this.filterToolsByTier(allTools, userTier);

      this.metrics.recordToolList(userTier, filteredTools.length);

      return {
        tools: filteredTools,
      };
    });

    // Execute tool
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const userId = request.params._meta?.userId;
      const userTier = request.params._meta?.tier;

      this.logger.info('Tool execution requested', {
        tool: name,
        user: userId,
        tier: userTier,
      });

      // Check rate limits
      const rateLimitOk = await this.checkRateLimit(userId, userTier);
      if (!rateLimitOk) {
        throw new Error('Rate limit exceeded for your tier');
      }

      // Route to appropriate module
      const result = await this.moduleRouter.executeTool(name, args, {
        userId,
        tier: userTier,
      });

      this.metrics.recordToolExecution(name, userTier, true);

      return result;
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    });

    // Metrics endpoint (Prometheus format)
    this.app.get('/metrics', (req, res) => {
      const metrics = this.metrics.getPrometheusMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    });

    // Tool discovery endpoint (for n8n)
    this.app.get('/mcp/tools', async (req, res) => {
      const userId = (req as any).user?.id;
      const userTier = (req as any).user?.tier || 'free';

      const allTools = await this.moduleRouter.getAllTools();
      const filteredTools = this.filterToolsByTier(allTools, userTier);

      res.json({
        tools: filteredTools,
        userTier,
        totalTools: filteredTools.length,
        rateLimit: this.getRateLimitForTier(userTier),
      });
    });

    // MCP endpoint (SSE transport)
    this.app.get('/mcp/sse', async (req, res) => {
      const transport = new SSEServerTransport('/mcp/sse', res);
      await this.mcpServer.connect(transport);
    });

    // MCP endpoint (HTTP transport)
    this.app.post('/mcp', async (req, res) => {
      try {
        // Add user metadata to request
        const enrichedRequest = {
          ...req.body,
          params: {
            ...req.body.params,
            _meta: {
              userId: (req as any).user?.id,
              tier: (req as any).user?.tier,
              domain: req.hostname,
            },
          },
        };

        // Process MCP request
        const result = await this.mcpServer.request(enrichedRequest, {
          signal: req.signal,
        });

        res.json(result);
      } catch (error) {
        this.logger.error('MCP request failed', { error });
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
          id: req.body.id,
        });
      }
    });

    // Error handler
    this.app.use((err: any, req: any, res: any, next: any) => {
      this.logger.error('Unhandled error', { error: err });
      this.metrics.recordError(err.message);

      res.status(err.status || 500).json({
        error: {
          message: err.message || 'Internal server error',
          code: err.code || 'INTERNAL_ERROR',
        },
      });
    });
  }

  private filterToolsByTier(tools: Tool[], tier: string): Tool[] {
    const tierLimits = {
      free: 30,
      starter: 60,
      pro: 100,
      enterprise: Infinity,
    };

    const limit = tierLimits[tier as keyof typeof tierLimits] || 30;

    // Priority order for tools
    const priorityModules = ['core', 'database', 'cloud', 'communication', 'developer'];

    // Sort tools by module priority
    const sortedTools = tools.sort((a, b) => {
      const aModule = a.name.split('_')[0];
      const bModule = b.name.split('_')[0];
      return priorityModules.indexOf(aModule) - priorityModules.indexOf(bModule);
    });

    return sortedTools.slice(0, limit);
  }

  private async checkRateLimit(userId: string, tier: string): Promise<boolean> {
    const rateLimits = {
      free: 100,      // per hour
      starter: 500,
      pro: 2000,
      enterprise: Infinity,
    };

    const limit = rateLimits[tier as keyof typeof rateLimits] || 100;

    // Use Redis for distributed rate limiting
    const redis = await this.getRedisClient();
    const key = `ratelimit:${userId}:${Math.floor(Date.now() / 3600000)}`;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 3600); // 1 hour
    }

    return current <= limit;
  }

  private getRateLimitForTier(tier: string): number {
    const rateLimits = {
      free: 100,
      starter: 500,
      pro: 2000,
      enterprise: 999999,
    };

    return rateLimits[tier as keyof typeof rateLimits] || 100;
  }

  private async getRedisClient() {
    // Implement Redis connection
    const { createClient } = await import('redis');
    const client = createClient({ url: this.config.redis.url });
    await client.connect();
    return client;
  }

  public async start(): Promise<void> {
    await this.moduleRouter.initialize();

    this.app.listen(this.config.port, this.config.host, () => {
      this.logger.info(`MCP Gateway listening on ${this.config.host}:${this.config.port}`);
      this.logger.info(`Domains: mcp.afterdarksys.com, mcp.n8nworkflo.ws`);
      this.logger.info(`Modules enabled: ${Object.keys(this.config.modules).filter(k => this.config.modules[k as keyof typeof this.config.modules]).join(', ')}`);
    });
  }

  public async stop(): Promise<void> {
    this.logger.info('Shutting down MCP Gateway');
    await this.moduleRouter.shutdown();
    process.exit(0);
  }
}

// Entry point
async function main() {
  const config: GatewayConfig = {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    oauth: {
      issuer: process.env.OAUTH_ISSUER || 'https://auth.afterdarksys.com',
      clientId: process.env.OAUTH_CLIENT_ID || '',
      clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
    },
    database: {
      url: process.env.DATABASE_URL || '',
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    modules: {
      core: process.env.ENABLE_CORE_MODULE !== 'false',
      cloud: process.env.ENABLE_CLOUD_MODULE !== 'false',
      database: process.env.ENABLE_DATABASE_MODULE !== 'false',
      communication: process.env.ENABLE_COMMUNICATION_MODULE !== 'false',
      developer: process.env.ENABLE_DEVELOPER_MODULE !== 'false',
    },
  };

  const gateway = new MCPGateway(config);

  // Graceful shutdown
  process.on('SIGTERM', () => gateway.stop());
  process.on('SIGINT', () => gateway.stop());

  await gateway.start();
}

if (require.main === module) {
  main().catch(console.error);
}

export default MCPGateway;
```

### 1.2 OAuth Middleware

```typescript
// src/gateway/auth/oauth-middleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Logger } from '../../shared/logger';

interface OAuthConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

interface JWTPayload {
  sub: string;
  email: string;
  tier: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export class OAuthMiddleware {
  private logger: Logger;
  private config: OAuthConfig;
  private jwksClient: jwksClient.JwksClient;

  constructor(config: OAuthConfig) {
    this.config = config;
    this.logger = new Logger('oauth-middleware');

    // Initialize JWKS client for token verification
    this.jwksClient = jwksClient({
      jwksUri: `${config.issuer}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 86400000, // 24 hours
    });
  }

  public async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing or invalid Authorization header',
          },
        });
        return;
      }

      const token = authHeader.substring(7);

      // Verify JWT token
      const payload = await this.verifyToken(token);

      // Attach user info to request
      (req as any).user = {
        id: payload.sub,
        email: payload.email,
        tier: payload.tier || 'free',
      };

      this.logger.debug('User authenticated', {
        userId: payload.sub,
        tier: payload.tier,
      });

      next();
    } catch (error) {
      this.logger.error('Authentication failed', { error });
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error instanceof Error ? error.message : 'Invalid token',
        },
      });
    }
  }

  private async verifyToken(token: string): Promise<JWTPayload> {
    return new Promise((resolve, reject) => {
      // Decode token header to get kid (key ID)
      const decoded = jwt.decode(token, { complete: true });

      if (!decoded || !decoded.header.kid) {
        reject(new Error('Invalid token format'));
        return;
      }

      // Get signing key from JWKS
      this.jwksClient.getSigningKey(decoded.header.kid, (err, key) => {
        if (err) {
          reject(err);
          return;
        }

        const signingKey = key.getPublicKey();

        // Verify token
        jwt.verify(
          token,
          signingKey,
          {
            issuer: this.config.issuer,
            audience: this.config.clientId,
            algorithms: ['RS256'],
          },
          (verifyErr, payload) => {
            if (verifyErr) {
              reject(verifyErr);
              return;
            }

            resolve(payload as JWTPayload);
          }
        );
      });
    });
  }
}
```

### 1.3 Module Router

```typescript
// src/gateway/routing/module-router.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../../shared/logger';

interface ModuleConfig {
  core: boolean;
  cloud: boolean;
  database: boolean;
  communication: boolean;
  developer: boolean;
}

interface ExecutionContext {
  userId: string;
  tier: string;
  workflowId?: string;
  executionId?: string;
}

export class ModuleRouter {
  private logger: Logger;
  private modules: Map<string, any>;
  private toolRegistry: Map<string, string>; // tool name -> module name
  private config: ModuleConfig;

  constructor(config: ModuleConfig) {
    this.config = config;
    this.logger = new Logger('module-router');
    this.modules = new Map();
    this.toolRegistry = new Map();
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing modules...');

    // Load core module (existing 60 tools)
    if (this.config.core) {
      await this.loadModule('core', '../../../unified-mcp-server/dist/index.js');
    }

    // Load cloud module (20 tools)
    if (this.config.cloud) {
      await this.loadModule('cloud', '../../modules/cloud/index.js');
    }

    // Load database module (15 tools)
    if (this.config.database) {
      await this.loadModule('database', '../../modules/database/index.js');
    }

    // Load communication module (15 tools)
    if (this.config.communication) {
      await this.loadModule('communication', '../../modules/communication/index.js');
    }

    // Load developer module (10 tools)
    if (this.config.developer) {
      await this.loadModule('developer', '../../modules/developer/index.js');
    }

    this.logger.info(`Loaded ${this.modules.size} modules with ${this.toolRegistry.size} tools`);
  }

  private async loadModule(name: string, path: string): Promise<void> {
    try {
      const module = await import(path);
      const instance = new module.default();

      // Initialize module
      await instance.initialize?.();

      // Register module
      this.modules.set(name, instance);

      // Register tools
      const tools = await instance.getTools();
      for (const tool of tools) {
        this.toolRegistry.set(tool.name, name);
        this.logger.debug(`Registered tool: ${tool.name} (module: ${name})`);
      }

      this.logger.info(`Loaded module: ${name} (${tools.length} tools)`);
    } catch (error) {
      this.logger.error(`Failed to load module: ${name}`, { error });
      throw error;
    }
  }

  public async getAllTools(): Promise<Tool[]> {
    const allTools: Tool[] = [];

    for (const [moduleName, module] of this.modules.entries()) {
      try {
        const tools = await module.getTools();
        allTools.push(...tools);
      } catch (error) {
        this.logger.error(`Failed to get tools from module: ${moduleName}`, { error });
      }
    }

    return allTools;
  }

  public async executeTool(
    toolName: string,
    args: any,
    context: ExecutionContext
  ): Promise<any> {
    const moduleName = this.toolRegistry.get(toolName);

    if (!moduleName) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const module = this.modules.get(moduleName);

    if (!module) {
      throw new Error(`Module not loaded: ${moduleName}`);
    }

    this.logger.info('Executing tool', {
      tool: toolName,
      module: moduleName,
      user: context.userId,
      tier: context.tier,
    });

    try {
      // Execute tool with timeout
      const timeout = this.getTimeoutForTier(context.tier);
      const result = await this.executeWithTimeout(
        module.executeTool(toolName, args, context),
        timeout
      );

      this.logger.debug('Tool executed successfully', { tool: toolName });

      return result;
    } catch (error) {
      this.logger.error('Tool execution failed', {
        tool: toolName,
        error,
      });
      throw error;
    }
  }

  private getTimeoutForTier(tier: string): number {
    const timeouts = {
      free: 30000,      // 30 seconds
      starter: 60000,   // 1 minute
      pro: 120000,      // 2 minutes
      enterprise: 300000, // 5 minutes
    };

    return timeouts[tier as keyof typeof timeouts] || 30000;
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Tool execution timeout')), timeout)
      ),
    ]);
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down modules...');

    for (const [moduleName, module] of this.modules.entries()) {
      try {
        await module.shutdown?.();
        this.logger.info(`Shutdown module: ${moduleName}`);
      } catch (error) {
        this.logger.error(`Failed to shutdown module: ${moduleName}`, { error });
      }
    }

    this.modules.clear();
    this.toolRegistry.clear();
  }
}
```

---

## 2. Module Implementations

### 2.1 Cloud Module Structure

```typescript
// src/modules/cloud/index.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { OCIModule } from './oci';
import { CloudflareModule } from './cloudflare';
import { DockerModule } from './docker';
import { Logger } from '../../shared/logger';

export class CloudModule {
  private logger: Logger;
  private ociModule: OCIModule;
  private cloudflareModule: CloudflareModule;
  private dockerModule: DockerModule;

  constructor() {
    this.logger = new Logger('cloud-module');
    this.ociModule = new OCIModule();
    this.cloudflareModule = new CloudflareModule();
    this.dockerModule = new DockerModule();
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing cloud module');

    await Promise.all([
      this.ociModule.initialize(),
      this.cloudflareModule.initialize(),
      this.dockerModule.initialize(),
    ]);

    this.logger.info('Cloud module initialized');
  }

  public async getTools(): Promise<Tool[]> {
    const tools = await Promise.all([
      this.ociModule.getTools(),
      this.cloudflareModule.getTools(),
      this.dockerModule.getTools(),
    ]);

    return tools.flat();
  }

  public async executeTool(toolName: string, args: any, context: any): Promise<any> {
    // Route to appropriate sub-module
    if (toolName.startsWith('oci_')) {
      return this.ociModule.executeTool(toolName, args, context);
    } else if (toolName.startsWith('cloudflare_')) {
      return this.cloudflareModule.executeTool(toolName, args, context);
    } else if (toolName.startsWith('docker_')) {
      return this.dockerModule.executeTool(toolName, args, context);
    } else {
      throw new Error(`Unknown cloud tool: ${toolName}`);
    }
  }

  public async shutdown(): Promise<void> {
    await Promise.all([
      this.ociModule.shutdown(),
      this.cloudflareModule.shutdown(),
      this.dockerModule.shutdown(),
    ]);
  }
}

export default CloudModule;
```

### 2.2 OCI Sub-Module Integration

```typescript
// src/modules/cloud/oci/index.ts

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Logger } from '../../../shared/logger';

// Import OCI SDK
import * as oci from 'oci-sdk';

export class OCIModule {
  private logger: Logger;
  private computeClient: oci.core.ComputeClient;
  private networkClient: oci.core.VirtualNetworkClient;
  private databaseClient: oci.database.DatabaseClient;

  constructor() {
    this.logger = new Logger('oci-module');
  }

  public async initialize(): Promise<void> {
    // Initialize OCI clients using config file or instance principal
    const provider = new oci.common.ConfigFileAuthenticationDetailsProvider();

    this.computeClient = new oci.core.ComputeClient({
      authenticationDetailsProvider: provider,
    });

    this.networkClient = new oci.core.VirtualNetworkClient({
      authenticationDetailsProvider: provider,
    });

    this.databaseClient = new oci.database.DatabaseClient({
      authenticationDetailsProvider: provider,
    });

    this.logger.info('OCI module initialized');
  }

  public async getTools(): Promise<Tool[]> {
    return [
      {
        name: 'oci_list_compute_instances',
        description: 'List all compute instances in a compartment',
        inputSchema: {
          type: 'object',
          properties: {
            compartmentId: {
              type: 'string',
              description: 'OCI compartment OCID',
            },
          },
          required: ['compartmentId'],
        },
      },
      {
        name: 'oci_manage_instance_lifecycle',
        description: 'Start, stop, restart, or terminate an instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Instance OCID',
            },
            action: {
              type: 'string',
              enum: ['START', 'STOP', 'SOFTRESET', 'RESET', 'TERMINATE'],
              description: 'Action to perform',
            },
          },
          required: ['instanceId', 'action'],
        },
      },
      {
        name: 'oci_get_instance_metrics',
        description: 'Get CPU, memory, and network metrics for an instance',
        inputSchema: {
          type: 'object',
          properties: {
            instanceId: {
              type: 'string',
              description: 'Instance OCID',
            },
            startTime: {
              type: 'string',
              description: 'Start time (ISO 8601)',
            },
            endTime: {
              type: 'string',
              description: 'End time (ISO 8601)',
            },
          },
          required: ['instanceId'],
        },
      },
      // ... more OCI tools
    ];
  }

  public async executeTool(toolName: string, args: any, context: any): Promise<any> {
    this.logger.info(`Executing OCI tool: ${toolName}`, { args });

    switch (toolName) {
      case 'oci_list_compute_instances':
        return this.listComputeInstances(args);

      case 'oci_manage_instance_lifecycle':
        return this.manageInstanceLifecycle(args);

      case 'oci_get_instance_metrics':
        return this.getInstanceMetrics(args);

      default:
        throw new Error(`Unknown OCI tool: ${toolName}`);
    }
  }

  private async listComputeInstances(args: { compartmentId: string }): Promise<any> {
    const request: oci.core.requests.ListInstancesRequest = {
      compartmentId: args.compartmentId,
    };

    const response = await this.computeClient.listInstances(request);

    return {
      instances: response.items.map(instance => ({
        id: instance.id,
        displayName: instance.displayName,
        lifecycleState: instance.lifecycleState,
        availabilityDomain: instance.availabilityDomain,
        shape: instance.shape,
        timeCreated: instance.timeCreated,
      })),
      count: response.items.length,
    };
  }

  private async manageInstanceLifecycle(args: {
    instanceId: string;
    action: string;
  }): Promise<any> {
    const request: oci.core.requests.InstanceActionRequest = {
      instanceId: args.instanceId,
      action: args.action as oci.core.models.InstanceAction,
    };

    const response = await this.computeClient.instanceAction(request);

    return {
      instanceId: response.instance.id,
      lifecycleState: response.instance.lifecycleState,
      message: `Instance ${args.action} initiated successfully`,
    };
  }

  private async getInstanceMetrics(args: {
    instanceId: string;
    startTime?: string;
    endTime?: string;
  }): Promise<any> {
    // Implementation using OCI Monitoring service
    // This is a simplified example
    return {
      instanceId: args.instanceId,
      metrics: {
        cpuUtilization: 45.2,
        memoryUtilization: 62.8,
        networkBytesIn: 1024000,
        networkBytesOut: 512000,
      },
      timestamp: new Date().toISOString(),
    };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down OCI module');
    // Close any open connections
  }
}
```

---

## 3. n8n Integration Examples

### 3.1 Custom n8n Node for MCP Gateway

```typescript
// n8n-nodes-mcp-gateway/nodes/MCPGateway/MCPGateway.node.ts

import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class MCPGateway implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'After Dark MCP Gateway',
    name: 'mcpGateway',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["tool"]}}',
    description: 'Interact with After Dark Systems MCP Gateway',
    defaults: {
      name: 'MCP Gateway',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'mcpGatewayOAuth2Api',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Domain',
        name: 'domain',
        type: 'options',
        options: [
          {
            name: 'Primary Gateway (afterdarksys.com)',
            value: 'https://mcp.afterdarksys.com',
          },
          {
            name: 'n8n Integration (n8nworkflo.ws)',
            value: 'https://mcp.n8nworkflo.ws',
          },
        ],
        default: 'https://mcp.n8nworkflo.ws',
        description: 'MCP gateway endpoint',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: [
          {
            name: 'List Tools',
            value: 'listTools',
          },
          {
            name: 'Execute Tool',
            value: 'executeTool',
          },
        ],
        default: 'executeTool',
      },
      {
        displayName: 'Tool Name',
        name: 'tool',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['executeTool'],
          },
        },
        default: '',
        placeholder: 'e.g., oci_list_compute_instances',
        description: 'Name of the MCP tool to execute',
      },
      {
        displayName: 'Arguments',
        name: 'arguments',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['executeTool'],
          },
        },
        default: '{}',
        description: 'Tool arguments as JSON',
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    const credentials = await this.getCredentials('mcpGatewayOAuth2Api');
    const domain = this.getNodeParameter('domain', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        if (operation === 'listTools') {
          // List available tools
          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'mcpGatewayOAuth2Api',
            {
              method: 'GET',
              url: `${domain}/mcp/tools`,
            }
          );

          returnData.push({
            json: response,
            pairedItem: { item: i },
          });
        } else if (operation === 'executeTool') {
          // Execute tool
          const toolName = this.getNodeParameter('tool', i) as string;
          const argsString = this.getNodeParameter('arguments', i) as string;
          const args = JSON.parse(argsString);

          const response = await this.helpers.httpRequestWithAuthentication.call(
            this,
            'mcpGatewayOAuth2Api',
            {
              method: 'POST',
              url: `${domain}/mcp`,
              body: {
                jsonrpc: '2.0',
                method: 'tools/call',
                params: {
                  name: toolName,
                  arguments: args,
                },
                id: Date.now(),
              },
            }
          );

          returnData.push({
            json: response.result,
            pairedItem: { item: i },
          });
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error.message,
            },
            pairedItem: { item: i },
          });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error);
      }
    }

    return [returnData];
  }
}
```

### 3.2 Example n8n Workflow JSON

```json
{
  "name": "MCP Database Provisioning",
  "nodes": [
    {
      "parameters": {},
      "name": "Manual Trigger",
      "type": "n8n-nodes-base.manualTrigger",
      "position": [250, 300],
      "id": "manual-trigger-1"
    },
    {
      "parameters": {
        "domain": "https://mcp.n8nworkflo.ws",
        "operation": "executeTool",
        "tool": "neon_create_project",
        "arguments": "{\n  \"name\": \"client-database\",\n  \"region\": \"us-east-1\"\n}"
      },
      "name": "Create Neon Project",
      "type": "afterdark.mcpGateway",
      "position": [450, 300],
      "id": "mcp-create-project"
    },
    {
      "parameters": {
        "domain": "https://mcp.n8nworkflo.ws",
        "operation": "executeTool",
        "tool": "neon_create_branch",
        "arguments": "={\n  \"projectId\": \"{{$json.projectId}}\",\n  \"branchName\": \"development\"\n}"
      },
      "name": "Create Dev Branch",
      "type": "afterdark.mcpGateway",
      "position": [650, 300],
      "id": "mcp-create-branch"
    },
    {
      "parameters": {
        "domain": "https://mcp.n8nworkflo.ws",
        "operation": "executeTool",
        "tool": "postgres_execute_query",
        "arguments": "={\n  \"connectionString\": \"{{$json.connectionString}}\",\n  \"query\": \"CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255), created_at TIMESTAMP DEFAULT NOW())\"\n}"
      },
      "name": "Create Schema",
      "type": "afterdark.mcpGateway",
      "position": [850, 300],
      "id": "mcp-execute-query"
    },
    {
      "parameters": {
        "domain": "https://mcp.n8nworkflo.ws",
        "operation": "executeTool",
        "tool": "slack_send_message",
        "arguments": "={\n  \"channel\": \"#devops\",\n  \"message\": \"Database provisioned: {{$node['Create Neon Project'].json.projectId}}\"\n}"
      },
      "name": "Send Notification",
      "type": "afterdark.mcpGateway",
      "position": [1050, 300],
      "id": "mcp-slack-notify"
    }
  ],
  "connections": {
    "Manual Trigger": {
      "main": [
        [
          {
            "node": "Create Neon Project",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Create Neon Project": {
      "main": [
        [
          {
            "node": "Create Dev Branch",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Create Dev Branch": {
      "main": [
        [
          {
            "node": "Create Schema",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Create Schema": {
      "main": [
        [
          {
            "node": "Send Notification",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## 4. Deployment Scripts

### 4.1 Complete Deployment Script

```bash
#!/bin/bash
# deploy-production.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}After Dark MCP Gateway Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Configuration
OCI_INSTANCE_IP="129.146.x.x"  # Replace with actual IP
OCI_USER="opc"
DEPLOYMENT_DIR="/opt/afterdark-mcp-gateway"
BACKUP_DIR="/opt/backups/mcp-gateway"

# Step 1: Create backup
echo -e "\n${YELLOW}Step 1: Creating backup...${NC}"
ssh $OCI_USER@$OCI_INSTANCE_IP << ENDSSH
  sudo mkdir -p $BACKUP_DIR
  if [ -d "$DEPLOYMENT_DIR" ]; then
    sudo tar -czf $BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz $DEPLOYMENT_DIR
    echo "Backup created successfully"
  fi
ENDSSH

# Step 2: Upload code
echo -e "\n${YELLOW}Step 2: Uploading code...${NC}"
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  ./ $OCI_USER@$OCI_INSTANCE_IP:$DEPLOYMENT_DIR/

# Step 3: Install dependencies and build
echo -e "\n${YELLOW}Step 3: Installing dependencies...${NC}"
ssh $OCI_USER@$OCI_INSTANCE_IP << ENDSSH
  cd $DEPLOYMENT_DIR
  npm ci
  npm run build
ENDSSH

# Step 4: Configure environment
echo -e "\n${YELLOW}Step 4: Configuring environment...${NC}"
ssh $OCI_USER@$OCI_INSTANCE_IP << 'ENDSSH'
  cd /opt/afterdark-mcp-gateway

  # Create .env file if it doesn't exist
  if [ ! -f .env.production ]; then
    cat > .env.production << EOF
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# OAuth Configuration
OAUTH_ISSUER=https://auth.afterdarksys.com
OAUTH_CLIENT_ID=mcp-gateway-prod
OAUTH_CLIENT_SECRET=${OAUTH_CLIENT_SECRET}

# Database
DATABASE_URL=postgresql://mcpuser:${DB_PASSWORD}@localhost:5432/mcpdb

# Redis
REDIS_URL=redis://localhost:6379

# Modules
ENABLE_CORE_MODULE=true
ENABLE_CLOUD_MODULE=true
ENABLE_DATABASE_MODULE=true
ENABLE_COMMUNICATION_MODULE=true
ENABLE_DEVELOPER_MODULE=true

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090
EOF
  fi
ENDSSH

# Step 5: Start services with Docker Compose
echo -e "\n${YELLOW}Step 5: Starting services...${NC}"
ssh $OCI_USER@$OCI_INSTANCE_IP << ENDSSH
  cd $DEPLOYMENT_DIR

  # Stop existing services
  sudo docker-compose -f docker-compose.mcp.yml down

  # Pull latest images
  sudo docker-compose -f docker-compose.mcp.yml pull

  # Start services
  sudo docker-compose -f docker-compose.mcp.yml up -d

  # Wait for services to be healthy
  echo "Waiting for services to be healthy..."
  sleep 30
ENDSSH

# Step 6: Health check
echo -e "\n${YELLOW}Step 6: Performing health check...${NC}"
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://$OCI_INSTANCE_IP:3000/health)

if [ "$HEALTH_CHECK" == "200" ]; then
  echo -e "${GREEN}✓ Health check passed${NC}"
else
  echo -e "${RED}✗ Health check failed (HTTP $HEALTH_CHECK)${NC}"
  exit 1
fi

# Step 7: Verify tools
echo -e "\n${YELLOW}Step 7: Verifying tool count...${NC}"
TOOL_COUNT=$(curl -s http://$OCI_INSTANCE_IP:3000/mcp/tools | jq '.totalTools')

if [ "$TOOL_COUNT" -ge 120 ]; then
  echo -e "${GREEN}✓ Tool count verified: $TOOL_COUNT tools${NC}"
else
  echo -e "${YELLOW}⚠ Tool count below target: $TOOL_COUNT tools${NC}"
fi

# Step 8: Configure load balancer
echo -e "\n${YELLOW}Step 8: Configuring OCI Load Balancer...${NC}"
# This would use OCI CLI commands to configure the load balancer
# Example:
# oci lb backend-set create ...

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nServices:"
echo -e "  • MCP Gateway: https://mcp.afterdarksys.com"
echo -e "  • n8n Integration: https://mcp.n8nworkflo.ws"
echo -e "  • Grafana Dashboard: http://$OCI_INSTANCE_IP:3001"
echo -e "  • Prometheus: http://$OCI_INSTANCE_IP:9090"
echo -e "\nNext steps:"
echo -e "  1. Verify DNS records point to Load Balancer IP"
echo -e "  2. Test OAuth authentication"
echo -e "  3. Create n8n workflow templates"
echo -e "  4. Monitor metrics in Grafana"
```

---

This implementation guide provides the core infrastructure code needed to deploy the MCP Gateway. The actual module integrations (OCI, Cloudflare, Neon, etc.) would require their respective SDKs and configurations, but this framework provides the foundation for integrating them all into a unified gateway.

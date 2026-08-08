#!/usr/bin/env node

/**
 * HTTP/HTTPS Server for Unified MCP
 * Compatible with `claude serve` and provides 10x enhanced functionality
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer as createHttpServer, Server as HttpServer } from 'http';
import { createServer as createHttpsServer, Server as HttpsServer } from 'https';
import { readFileSync } from 'fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
  JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';

import { FilesystemModule } from './modules/filesystem/index.js';
import { MemoryModule } from './modules/memory/index.js';
import { TerminalModule } from './modules/terminal/index.js';
import { OCIModule } from './modules/oci/index.js';
import { CloudflareModule } from './modules/cloudflare/index.js';
import { NeonModule } from './modules/neon/index.js';
import { GitHubModule } from './modules/github/index.js';
import { DockerModule } from './modules/docker/index.js';
import { TwilioModule } from './modules/twilio/index.js';
import { AWSModule } from './modules/aws/index.js';
import { GCPModule } from './modules/gcp/index.js';
import { AzureModule } from './modules/azure/index.js';
import { DigitalOceanModule } from './modules/digitalocean/index.js';
import { MacOSModule } from './modules/macos/index.js';
import { LinuxModule } from './modules/linux/index.js';
import { SSETransport } from './transports/sse-transport.js';
import { Logger } from './shared/utils.js';

const logger = new Logger('http-server');

interface HttpServerConfig {
  port?: number;
  host?: string;
  enabledModules?: string[];
  enableHttps?: boolean;
  certPath?: string;
  keyPath?: string;
  apiKey?: string;
  allowedOrigins?: string[];
  metricsEnabled?: boolean;
  filesystem?: {
    allowedPaths?: string[];
    maxFileSize?: number;
  };
  terminal?: {
    allowedCommands?: string[];
    blockedCommands?: string[];
    maxTimeout?: number;
    allowedPaths?: string[];
  };
  memory?: {
    persistPath?: string;
  };
  oci?: {
    tenancyId?: string;
    region?: string;
  };
  cloudflare?: {
    apiToken?: string;
    accountId?: string;
  };
  neon?: {
    apiKey?: string;
  };
  github?: {
    token?: string;
  };
  docker?: {
    socketPath?: string;
  };
  twilio?: {
    accountSid?: string;
    authToken?: string;
    defaultFromNumber?: string;
  };
  aws?: {
    region?: string;
    profile?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  gcp?: {
    project?: string;
    region?: string;
    zone?: string;
  };
  azure?: {
    subscriptionId?: string;
    resourceGroup?: string;
    location?: string;
  };
  digitalocean?: {
    accessToken?: string;
  };
  macos?: {
    allowAutomation?: boolean;
  };
  linux?: {
    allowSudo?: boolean;
  };
}

/**
 * Metrics collector for monitoring
 */
class MetricsCollector {
  private requestCount = 0;
  private errorCount = 0;
  private toolCalls = new Map<string, number>();
  private startTime = Date.now();

  incrementRequest(): void {
    this.requestCount++;
  }

  incrementError(): void {
    this.errorCount++;
  }

  recordToolCall(toolName: string): void {
    this.toolCalls.set(toolName, (this.toolCalls.get(toolName) || 0) + 1);
  }

  getMetrics() {
    return {
      uptime: Date.now() - this.startTime,
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        success: this.requestCount - this.errorCount,
      },
      toolCalls: Object.fromEntries(this.toolCalls),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * HTTP Server for Unified MCP
 */
class UnifiedMCPHttpServer {
  private app: Express;
  private httpServer?: HttpServer | HttpsServer;
  private mcpServer: Server;
  private modules = new Map<string, any>();
  private sseTransport: SSETransport;
  private config: HttpServerConfig;
  private metrics: MetricsCollector;

  constructor(config: HttpServerConfig = {}) {
    this.config = {
      port: 3000,
      host: '0.0.0.0',
      enabledModules: ['filesystem', 'memory', 'terminal', 'oci', 'cloudflare', 'neon', 'github', 'docker', 'twilio', 'aws', 'gcp', 'azure', 'digitalocean', 'macos', 'linux'],
      enableHttps: false,
      allowedOrigins: ['*'],
      metricsEnabled: true,
      ...config,
    };

    this.app = express();
    this.metrics = new MetricsCollector();
    this.sseTransport = new SSETransport({ endpoint: '/sse' });

    this.mcpServer = new Server(
      {
        name: 'unified-mcp-server-http',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.initializeModules();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupMCPHandlers();
  }

  /**
   * Initialize MCP modules
   */
  private initializeModules(): void {
    const { enabledModules } = this.config;

    if (enabledModules?.includes('filesystem')) {
      logger.info('Initializing filesystem module');
      this.modules.set('filesystem', new FilesystemModule(this.config.filesystem));
    }

    if (enabledModules?.includes('memory')) {
      logger.info('Initializing memory module');
      this.modules.set('memory', new MemoryModule());
    }

    if (enabledModules?.includes('terminal')) {
      logger.info('Initializing terminal module');
      this.modules.set('terminal', new TerminalModule(this.config.terminal));
    }

    if (enabledModules?.includes('oci')) {
      logger.info('Initializing OCI module');
      this.modules.set('oci', new OCIModule(this.config.oci));
    }

    if (enabledModules?.includes('cloudflare')) {
      logger.info('Initializing Cloudflare module');
      this.modules.set('cloudflare', new CloudflareModule(this.config.cloudflare));
    }

    if (enabledModules?.includes('neon')) {
      logger.info('Initializing Neon module');
      this.modules.set('neon', new NeonModule(this.config.neon));
    }

    if (enabledModules?.includes('github')) {
      logger.info('Initializing GitHub module');
      this.modules.set('github', new GitHubModule(this.config.github));
    }

    if (enabledModules?.includes('docker')) {
      logger.info('Initializing Docker module');
      this.modules.set('docker', new DockerModule(this.config.docker));
    }

    if (enabledModules?.includes('twilio')) {
      logger.info('Initializing Twilio module');
      this.modules.set('twilio', new TwilioModule(this.config.twilio));
    }

    if (enabledModules?.includes('aws')) {
      logger.info('Initializing AWS module');
      this.modules.set('aws', new AWSModule(this.config.aws));
    }

    if (enabledModules?.includes('gcp')) {
      logger.info('Initializing GCP module');
      this.modules.set('gcp', new GCPModule(this.config.gcp));
    }

    if (enabledModules?.includes('azure')) {
      logger.info('Initializing Azure module');
      this.modules.set('azure', new AzureModule(this.config.azure));
    }

    if (enabledModules?.includes('digitalocean')) {
      logger.info('Initializing DigitalOcean module');
      this.modules.set('digitalocean', new DigitalOceanModule(this.config.digitalocean));
    }

    if (enabledModules?.includes('macos')) {
      logger.info('Initializing macOS module');
      this.modules.set('macos', new MacOSModule(this.config.macos));
    }

    if (enabledModules?.includes('linux')) {
      logger.info('Initializing Linux module');
      this.modules.set('linux', new LinuxModule(this.config.linux));
    }

    logger.info(`Initialized ${this.modules.size} modules: ${Array.from(this.modules.keys()).join(', ')}`);
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // CORS
    this.app.use(
      cors({
        origin: this.config.allowedOrigins,
        credentials: true,
      })
    );

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.text());

    // Request logging and metrics
    this.app.use((req, res, next) => {
      this.metrics.incrementRequest();
      logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
      next();
    });

    // API Key authentication middleware
    if (this.config.apiKey) {
      this.app.use('/api/*', this.authMiddleware.bind(this));
      this.app.use('/sse', this.authMiddleware.bind(this));
      this.app.use('/mcp', this.authMiddleware.bind(this));
    }

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.metrics.incrementError();
      logger.error('Express error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
  }

  /**
   * Authentication middleware
   */
  private authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    const apiKey = authHeader?.replace('Bearer ', '');

    if (!apiKey || apiKey !== this.config.apiKey) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        version: '2.0.0',
        modules: Array.from(this.modules.keys()),
        connections: this.sseTransport.getConnectionCount(),
        timestamp: new Date().toISOString(),
      });
    });

    // Metrics endpoint
    if (this.config.metricsEnabled) {
      this.app.get('/metrics', (req, res) => {
        res.json(this.metrics.getMetrics());
      });
    }

    // MCP Server info endpoint
    this.app.get('/api/mcp/info', async (req, res) => {
      const tools = await this.getAllTools();
      res.json({
        name: 'unified-mcp-server-http',
        version: '2.0.0',
        modules: Array.from(this.modules.keys()),
        toolCount: tools.length,
        capabilities: {
          tools: true,
          prompts: false,
          resources: false,
        },
      });
    });

    // List all available tools
    this.app.get('/api/mcp/tools', async (req, res) => {
      try {
        const tools = await this.getAllTools();
        res.json({ tools });
      } catch (error) {
        logger.error('Error listing tools:', error);
        res.status(500).json({ error: 'Failed to list tools' });
      }
    });

    // Generate mcp_servers.json configuration
    this.app.get('/api/mcp/config', (req, res) => {
      const protocol = this.config.enableHttps ? 'https' : 'http';
      const host = req.headers.host || `${this.config.host}:${this.config.port}`;

      const mcpConfig = {
        mcpServers: {
          'unified-mcp-server': {
            url: `${protocol}://${host}/sse`,
            transport: 'sse',
            headers: this.config.apiKey
              ? {
                  Authorization: `Bearer ${this.config.apiKey}`,
                }
              : undefined,
          },
        },
      };

      res.json(mcpConfig);
    });

    // Download mcp_servers.json file
    this.app.get('/download/mcp_servers.json', (req, res) => {
      const protocol = this.config.enableHttps ? 'https' : 'http';
      const host = req.headers.host || `${this.config.host}:${this.config.port}`;

      const mcpConfig = {
        mcpServers: {
          'unified-mcp-server': {
            url: `${protocol}://${host}/sse`,
            transport: 'sse',
            headers: this.config.apiKey
              ? {
                  Authorization: `Bearer ${this.config.apiKey}`,
                }
              : undefined,
          },
        },
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="mcp_servers.json"');
      res.send(JSON.stringify(mcpConfig, null, 2));
    });

    // SSE endpoint for MCP communication
    this.app.get('/sse', (req, res) => {
      this.sseTransport.handleSSEConnection(req, res);
    });

    // JSON-RPC endpoint for MCP requests
    this.app.post('/mcp', async (req, res) => {
      try {
        const message = req.body as JSONRPCMessage;
        await this.handleMCPMessage(message, res);
      } catch (error) {
        logger.error('Error handling MCP message:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: 'Internal error',
          },
        });
      }
    });

    // Serve a simple web UI
    this.app.get('/', (req, res) => {
      res.send(this.getWebUI());
    });
  }

  /**
   * Setup MCP server handlers
   */
  private setupMCPHandlers(): void {
    // List tools handler
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = await this.getAllTools();
      logger.debug(`Listing ${tools.length} tools`);
      return { tools };
    });

    // Call tool handler
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this.metrics.recordToolCall(name);

      logger.debug(`Tool call received: ${name}`, args);

      try {
        const [moduleName, ...toolNameParts] = name.split('_');
        const toolName = toolNameParts.join('_');

        if (!moduleName) {
          throw new McpError(ErrorCode.InvalidParams, `Invalid tool name format: ${name}`);
        }

        const module = this.modules.get(moduleName);
        if (!module) {
          throw new McpError(ErrorCode.MethodNotFound, `Module '${moduleName}' not found`);
        }

        const result = await module.handleTool(toolName, args || {});

        logger.debug(`Tool call completed: ${name}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`Tool call failed: ${name}`, error);
        this.metrics.incrementError();

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${(error as Error).message}`);
      }
    });

    // Error handler
    this.mcpServer.onerror = (error) => {
      logger.error('MCP Server error:', error);
      this.metrics.incrementError();
    };

    // Connect SSE transport
    this.sseTransport.on('message', async (message: JSONRPCMessage) => {
      await this.handleMCPMessage(message);
    });
  }

  /**
   * Handle incoming MCP message
   */
  private async handleMCPMessage(message: JSONRPCMessage, res?: Response): Promise<void> {
    // Route message to appropriate handler based on method
    if ('method' in message) {
      if (message.method === 'tools/list') {
        const response = await this.mcpServer.request(
          { method: 'tools/list', params: {}, jsonrpc: '2.0' } as any,
          ListToolsRequestSchema
        );

        if (res) {
          res.json(response);
        } else {
          await this.sseTransport.send(response as any);
        }
      } else if (message.method === 'tools/call') {
        const response = await this.mcpServer.request(message as any, CallToolRequestSchema);

        if (res) {
          res.json(response);
        } else {
          await this.sseTransport.send(response as any);
        }
      }
    }
  }

  /**
   * Get all available tools from all modules
   */
  private async getAllTools(): Promise<any[]> {
    const allTools: any[] = [];

    for (const [moduleName, module] of this.modules.entries()) {
      const moduleTools = module.getTools();
      const namespacedTools = moduleTools.map((tool: any) => ({
        ...tool,
        name: `${moduleName}_${tool.name}`,
        description: `[${moduleName.toUpperCase()}] ${tool.description}`,
      }));
      allTools.push(...namespacedTools);
    }

    return allTools;
  }

  /**
   * Generate simple web UI
   */
  private getWebUI(): string {
    const protocol = this.config.enableHttps ? 'https' : 'http';
    const baseUrl = `${protocol}://${this.config.host}:${this.config.port}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <title>Unified MCP Server</title>
  <style>
    body { font-family: sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #333; }
    .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .method { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; margin-right: 10px; }
    .get { background: #61affe; color: white; }
    .post { background: #49cc90; color: white; }
    code { background: #eee; padding: 2px 5px; border-radius: 3px; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>🚀 After Dark Systems Unified MCP Server</h1>
  <p>HTTP/HTTPS server serving <strong>${this.modules.size} modules</strong> with <strong>183 tools</strong></p>
  <p style="color:#666;font-size:0.9em;">
    <strong>Core:</strong> filesystem (9) • memory (9) • terminal (10)<br>
    <strong>Cloud:</strong> oci (8) • cloudflare (13) • neon (14) • aws (14) • gcp (14) • azure (14) • digitalocean (14)<br>
    <strong>Services:</strong> github (12) • docker (14) • twilio (10)<br>
    <strong>System:</strong> macos (14) • linux (14)
  </p>

  <div style="background:#e8f4e8; border:2px solid #4CAF50; border-radius:8px; padding:15px; margin:20px 0; text-align:center;">
    <a href="/download/mcp_servers.json" style="font-size:1.2em; font-weight:bold; color:#2e7d32;">
      📥 Download mcp_servers.json for Local Use
    </a>
    <p style="margin:5px 0 0 0; color:#555; font-size:0.9em;">Add this configuration to Claude Desktop or any MCP-compatible client</p>
  </div>

  <h2>📡 Endpoints</h2>

  <div class="endpoint">
    <span class="method get">GET</span>
    <a href="/health">/health</a>
    <p>Health check and server status</p>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <a href="/metrics">/metrics</a>
    <p>Server metrics and statistics</p>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <a href="/api/mcp/info">/api/mcp/info</a>
    <p>MCP server information</p>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <a href="/api/mcp/tools">/api/mcp/tools</a>
    <p>List all available MCP tools</p>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <a href="/api/mcp/config">/api/mcp/config</a>
    <p>Get mcp_servers.json configuration</p>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <a href="/download/mcp_servers.json">/download/mcp_servers.json</a>
    <p>Download mcp_servers.json file</p>
  </div>

  <div class="endpoint">
    <span class="method get">GET</span>
    <code>/sse</code>
    <p>Server-Sent Events endpoint for MCP communication</p>
  </div>

  <div class="endpoint">
    <span class="method post">POST</span>
    <code>/mcp</code>
    <p>JSON-RPC endpoint for MCP requests</p>
  </div>

  <h2>📚 Usage with Claude</h2>
  <pre>
# Add to your Claude Desktop config:
{
  "mcpServers": {
    "unified-mcp-server": {
      "url": "${baseUrl}/sse",
      "transport": "sse"${this.config.apiKey ? `,
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }` : ''}
    }
  }
}
  </pre>

  <h2>🐳 Docker</h2>
  <pre>
docker run -p ${this.config.port}:${this.config.port} \\
  -e API_KEY=your-secret-key \\
  unified-mcp-server
  </pre>

  <p><a href="/download/mcp_servers.json">📥 Download mcp_servers.json</a></p>
</body>
</html>
    `;
  }

  /**
   * Start the HTTP/HTTPS server
   */
  async start(): Promise<void> {
    await this.sseTransport.start();

    const { port, host, enableHttps, certPath, keyPath } = this.config;

    if (enableHttps && certPath && keyPath) {
      // HTTPS server
      const httpsOptions = {
        cert: readFileSync(certPath),
        key: readFileSync(keyPath),
      };
      this.httpServer = createHttpsServer(httpsOptions, this.app);
      logger.info(`Starting HTTPS server on ${host}:${port}`);
    } else {
      // HTTP server
      this.httpServer = createHttpServer(this.app);
      logger.info(`Starting HTTP server on ${host}:${port}`);
    }

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(port, host as string, () => {
        logger.info(`✅ Server running at ${enableHttps ? 'https' : 'http'}://${host}:${port}`);
        logger.info(`📡 SSE endpoint: ${enableHttps ? 'https' : 'http'}://${host}:${port}/sse`);
        logger.info(`🔧 Modules: ${Array.from(this.modules.keys()).join(', ')}`);
        resolve();
      });

      this.httpServer!.on('error', reject);
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    logger.info('Stopping server...');

    await this.sseTransport.close();

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }

    // Cleanup modules
    for (const [moduleName, module] of this.modules.entries()) {
      if (module.cleanup) {
        try {
          await module.cleanup();
          logger.debug(`Cleaned up module: ${moduleName}`);
        } catch (error) {
          logger.error(`Error cleaning up module ${moduleName}:`, error);
        }
      }
    }

    logger.info('Server stopped');
  }
}

// CLI execution
async function main(): Promise<void> {
  const defaultModules = ['filesystem', 'memory', 'terminal', 'oci', 'cloudflare', 'neon', 'github', 'docker', 'twilio', 'aws', 'gcp', 'azure', 'digitalocean', 'macos', 'linux'];

  const config: HttpServerConfig = {
    port: parseInt(process.env['PORT'] || '3000'),
    host: process.env['HOST'] || '0.0.0.0',
    apiKey: process.env['API_KEY'],
    enableHttps: process.env['ENABLE_HTTPS'] === 'true',
    certPath: process.env['CERT_PATH'],
    keyPath: process.env['KEY_PATH'],
    enabledModules: process.env['MODULES']?.split(',') || defaultModules,
    // Cloud provider configs from environment
    oci: {
      tenancyId: process.env['OCI_TENANCY_ID'],
      region: process.env['OCI_REGION'],
    },
    cloudflare: {
      apiToken: process.env['CLOUDFLARE_API_TOKEN'],
      accountId: process.env['CLOUDFLARE_ACCOUNT_ID'],
    },
    neon: {
      apiKey: process.env['NEON_API_KEY'],
    },
    github: {
      token: process.env['GITHUB_TOKEN'],
    },
    docker: {
      socketPath: process.env['DOCKER_SOCKET'] || '/var/run/docker.sock',
    },
    twilio: {
      accountSid: process.env['TWILIO_ACCOUNT_SID'],
      authToken: process.env['TWILIO_AUTH_TOKEN'],
      defaultFromNumber: process.env['TWILIO_PHONE_NUMBER'],
    },
    aws: {
      region: process.env['AWS_REGION'] || process.env['AWS_DEFAULT_REGION'],
      profile: process.env['AWS_PROFILE'],
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'],
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
    },
    gcp: {
      project: process.env['GCP_PROJECT'] || process.env['GOOGLE_CLOUD_PROJECT'],
      region: process.env['GCP_REGION'],
      zone: process.env['GCP_ZONE'],
    },
    azure: {
      subscriptionId: process.env['AZURE_SUBSCRIPTION_ID'],
      resourceGroup: process.env['AZURE_RESOURCE_GROUP'],
      location: process.env['AZURE_LOCATION'],
    },
    digitalocean: {
      accessToken: process.env['DIGITALOCEAN_ACCESS_TOKEN'] || process.env['DO_ACCESS_TOKEN'],
    },
  };

  logger.info('After Dark Systems Unified MCP Server v2.0.0');
  logger.info(`Configuring ${config.enabledModules?.length} modules...`);

  const server = new UnifiedMCPHttpServer(config);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await server.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { UnifiedMCPHttpServer };

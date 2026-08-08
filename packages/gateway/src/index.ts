#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
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
import { Logger } from './shared/utils.js';

const logger = new Logger('unified-server');

interface UnifiedServerConfig {
  enabledModules?: string[];
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

class UnifiedMCPServer {
  private server: Server;
  private modules = new Map<string, any>();
  private config: UnifiedServerConfig;

  constructor(config: UnifiedServerConfig = {}) {
    this.config = {
      enabledModules: ['filesystem', 'memory', 'terminal', 'oci', 'cloudflare', 'neon', 'github', 'docker', 'twilio', 'aws', 'gcp', 'azure', 'digitalocean', 'macos', 'linux'],
      ...config,
    };

    this.server = new Server(
      {
        name: 'unified-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.initializeModules();
    this.setupHandlers();
  }

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

  private setupHandlers(): void {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools: any[] = [];

      for (const [moduleName, module] of this.modules.entries()) {
        const moduleTools = module.getTools();
        // Prefix tool names with module name for namespacing
        const namespacedTools = moduleTools.map((tool: any) => ({
          ...tool,
          name: `${moduleName}_${tool.name}`,
          description: `[${moduleName.toUpperCase()}] ${tool.description}`,
        }));
        allTools.push(...namespacedTools);
      }

      logger.debug(`Listing ${allTools.length} tools across ${this.modules.size} modules`);
      return { tools: allTools };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.debug(`Tool call received: ${name}`, args);

      try {
        // Parse the tool name to extract module and tool
        const [moduleName, ...toolNameParts] = name.split('_');
        const toolName = toolNameParts.join('_');

        if (!moduleName) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Invalid tool name format: ${name}`
          );
        }

        const module = this.modules.get(moduleName);
        if (!module) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Module '${moduleName}' not found or not enabled`
          );
        }

        if (!module.handleTool) {
          throw new McpError(
            ErrorCode.InternalError,
            `Module '${moduleName}' does not support tool handling`
          );
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

        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${(error as Error).message}`
        );
      }
    });

    // Error handler
    this.server.onerror = (error) => {
      logger.error('Server error:', error);
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();

    logger.info('Starting Unified MCP Server...');
    logger.info(`Enabled modules: ${this.config.enabledModules?.join(', ')}`);

    await this.server.connect(transport);
    logger.info('Unified MCP Server started successfully');
  }

  async stop(): Promise<void> {
    logger.info('Stopping Unified MCP Server...');

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

    logger.info('Unified MCP Server stopped');
  }
}

// CLI argument parsing
function parseArguments(): UnifiedServerConfig {
  const args = process.argv.slice(2);
  const config: UnifiedServerConfig = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--modules':
        if (i + 1 < args.length) {
          config.enabledModules = args[i + 1]?.split(',');
          i++;
        }
        break;
      case '--allowed-paths':
        if (i + 1 < args.length) {
          config.filesystem = {
            ...config.filesystem,
            allowedPaths: args[i + 1]?.split(','),
          };
          i++;
        }
        break;
      case '--debug':
        process.env['DEBUG'] = '1';
        break;
      case '--help':
        console.log(`
Unified MCP Server - After Dark Systems MCP Gateway with 180+ tools

Usage: unified-mcp-server [options]

Options:
  --modules <modules>        Comma-separated list of modules to enable
  --allowed-paths <paths>    Comma-separated list of allowed filesystem paths
  --debug                    Enable debug logging
  --help                     Show this help message

Examples:
  unified-mcp-server
  unified-mcp-server --modules filesystem,memory,cloudflare,aws
  unified-mcp-server --allowed-paths /workspace,/home/user/projects
  unified-mcp-server --debug

Available Modules:
  Core:
    filesystem:    File operations (read, write, search, etc.) - 9 tools
    memory:        Knowledge graph with entities and relations - 9 tools
    terminal:      Command execution and process management - 10 tools

  Cloud Providers:
    oci:           Oracle Cloud Infrastructure management - 8 tools
    cloudflare:    DNS, Workers, KV, Cache management - 13 tools
    neon:          Serverless PostgreSQL database management - 14 tools
    aws:           Amazon Web Services (EC2, S3, Lambda, etc.) - 14 tools
    gcp:           Google Cloud Platform (GCE, GCS, Cloud Functions) - 14 tools
    azure:         Microsoft Azure (VMs, Storage, Functions) - 14 tools
    digitalocean:  DigitalOcean (Droplets, Spaces, Apps) - 14 tools

  Services:
    github:        Repository, issues, PRs, workflows - 12 tools
    docker:        Container, image, volume management - 14 tools
    twilio:        SMS, voice, phone number management - 10 tools

  System:
    macos:         macOS system operations and automation - 14 tools
    linux:         Linux system operations (Ubuntu/Debian/RedHat) - 14 tools

Total: 183 tools across 15 modules

Environment Variables:
  OCI_TENANCY_ID, OCI_REGION              - Oracle Cloud credentials
  CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID - Cloudflare credentials
  NEON_API_KEY                            - Neon database credentials
  GITHUB_TOKEN                            - GitHub personal access token
  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN   - Twilio credentials
  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY - AWS credentials
  AWS_REGION, AWS_PROFILE                 - AWS region and profile
  GCP_PROJECT, GCP_REGION, GCP_ZONE       - Google Cloud credentials
  AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP - Azure credentials
  DIGITALOCEAN_ACCESS_TOKEN               - DigitalOcean credentials
        `);
        process.exit(0);
        break;
    }
  }

  return config;
}

// Main execution
async function main(): Promise<void> {
  try {
    const config = parseArguments();
    const server = new UnifiedMCPServer(config);

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
      process.exit(1);
    });

    await server.start();
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Only run if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { UnifiedMCPServer };
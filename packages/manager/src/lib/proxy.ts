import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  StreamableHTTPServerTransport,
  type StreamableHTTPServerTransportOptions,
} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createServer, type Server as HttpServer } from "node:http";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type { Registry, ServerEntry } from "./registry.js";

interface ConnectedPlugin {
  name: string;
  client: Client;
  transport: StdioClientTransport;
}

interface ToolRoute {
  plugin: ConnectedPlugin;
  originalName: string;
}

export function namespaceTool(plugin: string, tool: string): string {
  return `${plugin}__${tool}`;
}

function runtimeEnvironment(entry: ServerEntry): Record<string, string> {
  const inherited = getDefaultEnvironment();
  const configured = Object.fromEntries(
    Object.entries(entry.env ?? {}).map(([key, value]) => [
      key,
      value.replace(/\$\{([^}]+)\}/g, (_match, envName: string) => process.env[envName] ?? ""),
    ]),
  );
  return { ...inherited, ...configured };
}

export function assertLoopbackHost(host: string): void {
  if (!["127.0.0.1", "::1", "localhost"].includes(host)) {
    throw new Error("The unauthenticated gateway may only bind to a loopback address");
  }
}

export class UnifiedMcpProxy {
  private server?: Server;
  private readonly plugins: ConnectedPlugin[] = [];
  private readonly routes = new Map<string, ToolRoute>();
  private readonly tools: Array<Record<string, unknown>> = [];
  private httpServer?: HttpServer;

  constructor(private readonly registry: Registry) {}

  private createServer(): Server {
    const server = new Server(
      { name: "afterdark-mcp-builder", version: "0.1.0" },
      { capabilities: { tools: {} } },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: this.tools as never[] }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const route = this.routes.get(request.params.name);
      if (!route) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      return await route.plugin.client.callTool({
        name: route.originalName,
        arguments: request.params.arguments,
      }) as never;
    });
    return server;
  }

  async connectPlugins(): Promise<void> {
    for (const [name, entry] of Object.entries(this.registry.servers)) {
      if (!entry.enabled || !entry.command) continue;
      const transport = new StdioClientTransport({
        command: entry.command,
        ...(entry.args ? { args: entry.args } : {}),
        env: runtimeEnvironment(entry),
        stderr: "inherit",
      });
      const client = new Client({ name: "afterdark-mcp-proxy", version: "0.1.0" });
      try {
        await client.connect(transport);
        const plugin = { name, client, transport };
        const listed = await client.listTools();
        for (const tool of listed.tools) {
          const exposedName = namespaceTool(name, tool.name);
          this.routes.set(exposedName, { plugin, originalName: tool.name });
          this.tools.push({
            ...tool,
            name: exposedName,
            description: `[${name}] ${tool.description ?? tool.name}`,
          });
        }
        this.plugins.push(plugin);
        console.error(`[mcp-builder] connected ${name}: ${listed.tools.length} tool(s)`);
      } catch (error) {
        console.error(`[mcp-builder] failed to connect ${name}: ${error instanceof Error ? error.message : String(error)}`);
        await transport.close().catch(() => undefined);
      }
    }
  }

  async serve(): Promise<void> {
    await this.connectPlugins();
    this.server = this.createServer();
    await this.server.connect(new StdioServerTransport());
  }

  async serveHttp(host: string, port: number): Promise<void> {
    assertLoopbackHost(host);
    await this.connectPlugins();
    this.httpServer = createServer((request, response) => {
      if (request.url === "/health" && request.method === "GET") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: "ok", plugins: this.plugins.length, tools: this.tools.length }));
        return;
      }
      if (request.url !== "/mcp") {
        response.writeHead(404).end();
        return;
      }
      void (async () => {
        const transport = new StreamableHTTPServerTransport(
          { sessionIdGenerator: undefined } as unknown as StreamableHTTPServerTransportOptions,
        );
        const requestServer = this.createServer();
        await requestServer.connect(transport as unknown as Transport);
        response.once("close", () => {
          void transport.close();
          void requestServer.close();
        });
        await transport.handleRequest(request, response);
      })().catch((error: unknown) => {
          console.error(`[mcp-builder] HTTP transport error: ${error instanceof Error ? error.message : String(error)}`);
          if (!response.headersSent) response.writeHead(500);
          response.end();
        });
    });
    await new Promise<void>((resolve, reject) => {
      this.httpServer?.once("error", reject);
      this.httpServer?.listen(port, host, () => resolve());
    });
    console.error(`[mcp-builder] gateway listening at http://${host}:${port}/mcp`);
  }

  async close(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer?.close((error) => error ? reject(error) : resolve());
      });
    }
    await Promise.allSettled(this.plugins.map(({ client }) => client.close()));
    if (this.server) await this.server.close();
  }
}

/**
 * SSE (Server-Sent Events) Transport for MCP
 * Compatible with `claude serve` and HTTP-based MCP clients
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';
import { EventEmitter } from 'events';

export interface SSETransportOptions {
  endpoint?: string;
  heartbeatInterval?: number;
}

/**
 * SSE Transport implementation for serving MCP over HTTP
 */
export class SSETransport extends EventEmitter implements Transport {
  private messageQueue: JSONRPCMessage[] = [];
  private clients: Set<Response> = new Set();
  private heartbeatTimer?: NodeJS.Timeout;
  private readonly endpoint: string;
  private readonly heartbeatInterval: number;

  constructor(options: SSETransportOptions = {}) {
    super();
    this.endpoint = options.endpoint || '/sse';
    this.heartbeatInterval = options.heartbeatInterval || 30000;
  }

  /**
   * Start the transport
   */
  async start(): Promise<void> {
    // Start heartbeat to keep connections alive
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // Close all client connections
    for (const client of this.clients) {
      try {
        client.end();
      } catch (error) {
        // Ignore errors when closing
      }
    }
    this.clients.clear();
  }

  /**
   * Send a JSON-RPC message to all connected clients
   */
  async send(message: JSONRPCMessage): Promise<void> {
    const data = JSON.stringify(message);

    for (const client of this.clients) {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (error) {
        console.error('Error sending message to client:', error);
        this.clients.delete(client);
      }
    }
  }

  /**
   * Handle SSE connection from Express
   */
  handleSSEConnection(req: Request, res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Add client to active connections
    this.clients.add(res);

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Handle incoming JSON-RPC message from HTTP POST
   */
  handleMessage(message: JSONRPCMessage): void {
    this.emit('message', message);
  }

  /**
   * Send heartbeat to keep connections alive
   */
  private sendHeartbeat(): void {
    for (const client of this.clients) {
      try {
        client.write(': heartbeat\n\n');
      } catch (error) {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Get number of active connections
   */
  getConnectionCount(): number {
    return this.clients.size;
  }
}

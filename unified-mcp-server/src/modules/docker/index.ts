/**
 * Docker Module
 * Provides tools for managing Docker containers, images, and volumes
 */

import { Logger } from '../../shared/utils.js';

const logger = new Logger('docker');

export interface DockerConfig {
  socketPath?: string;
  host?: string;
}

export class DockerModule {
  private socketPath: string;

  constructor(config: DockerConfig = {}) {
    this.socketPath = config.socketPath || '/var/run/docker.sock';
    logger.info(`Docker module initialized with socket: ${this.socketPath}`);
  }

  getTools() {
    return [
      // Container Tools
      {
        name: 'list_containers',
        description: 'List Docker containers',
        inputSchema: {
          type: 'object',
          properties: {
            all: { type: 'boolean', description: 'Show all containers (including stopped)' },
            filters: { type: 'object', description: 'Filter containers' },
          },
        },
      },
      {
        name: 'get_container',
        description: 'Get container details',
        inputSchema: {
          type: 'object',
          properties: {
            containerId: { type: 'string', description: 'Container ID or name' },
          },
          required: ['containerId'],
        },
      },
      {
        name: 'start_container',
        description: 'Start a stopped container',
        inputSchema: {
          type: 'object',
          properties: {
            containerId: { type: 'string', description: 'Container ID or name' },
          },
          required: ['containerId'],
        },
      },
      {
        name: 'stop_container',
        description: 'Stop a running container',
        inputSchema: {
          type: 'object',
          properties: {
            containerId: { type: 'string', description: 'Container ID or name' },
            timeout: { type: 'number', description: 'Timeout in seconds before killing' },
          },
          required: ['containerId'],
        },
      },
      {
        name: 'restart_container',
        description: 'Restart a container',
        inputSchema: {
          type: 'object',
          properties: {
            containerId: { type: 'string', description: 'Container ID or name' },
            timeout: { type: 'number', description: 'Timeout in seconds' },
          },
          required: ['containerId'],
        },
      },
      {
        name: 'container_logs',
        description: 'Get container logs',
        inputSchema: {
          type: 'object',
          properties: {
            containerId: { type: 'string', description: 'Container ID or name' },
            tail: { type: 'number', description: 'Number of lines from end' },
            since: { type: 'string', description: 'Show logs since timestamp' },
          },
          required: ['containerId'],
        },
      },
      {
        name: 'container_stats',
        description: 'Get container resource usage statistics',
        inputSchema: {
          type: 'object',
          properties: {
            containerId: { type: 'string', description: 'Container ID or name' },
          },
          required: ['containerId'],
        },
      },
      // Image Tools
      {
        name: 'list_images',
        description: 'List Docker images',
        inputSchema: {
          type: 'object',
          properties: {
            all: { type: 'boolean', description: 'Show all images' },
            dangling: { type: 'boolean', description: 'Show dangling images only' },
          },
        },
      },
      {
        name: 'pull_image',
        description: 'Pull an image from a registry',
        inputSchema: {
          type: 'object',
          properties: {
            image: { type: 'string', description: 'Image name with optional tag' },
          },
          required: ['image'],
        },
      },
      {
        name: 'remove_image',
        description: 'Remove an image',
        inputSchema: {
          type: 'object',
          properties: {
            imageId: { type: 'string', description: 'Image ID or name:tag' },
            force: { type: 'boolean', description: 'Force removal' },
          },
          required: ['imageId'],
        },
      },
      // Volume Tools
      {
        name: 'list_volumes',
        description: 'List Docker volumes',
        inputSchema: {
          type: 'object',
          properties: {
            dangling: { type: 'boolean', description: 'Show dangling volumes only' },
          },
        },
      },
      // Network Tools
      {
        name: 'list_networks',
        description: 'List Docker networks',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      // System Tools
      {
        name: 'docker_info',
        description: 'Get Docker system information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'docker_prune',
        description: 'Remove unused Docker resources',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Type: containers, images, volumes, networks, system' },
          },
          required: ['type'],
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    logger.debug(`Handling Docker tool: ${name}`, args);

    try {
      switch (name) {
        case 'list_containers':
          return await this.listContainers(args);
        case 'get_container':
          return await this.getContainer(args.containerId);
        case 'start_container':
          return await this.startContainer(args.containerId);
        case 'stop_container':
          return await this.stopContainer(args.containerId, args.timeout);
        case 'restart_container':
          return await this.restartContainer(args.containerId, args.timeout);
        case 'container_logs':
          return await this.containerLogs(args);
        case 'container_stats':
          return await this.containerStats(args.containerId);
        case 'list_images':
          return await this.listImages(args);
        case 'pull_image':
          return await this.pullImage(args.image);
        case 'remove_image':
          return await this.removeImage(args.imageId, args.force);
        case 'list_volumes':
          return await this.listVolumes(args);
        case 'list_networks':
          return await this.listNetworks();
        case 'docker_info':
          return await this.dockerInfo();
        case 'docker_prune':
          return await this.dockerPrune(args.type);
        default:
          throw new Error(`Unknown Docker tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error in Docker ${name}:`, error);
      throw error;
    }
  }

  private async executeDockerCommand(args: string[]): Promise<any> {
    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const docker = spawn('docker', args);

      let stdout = '';
      let stderr = '';

      docker.stdout.on('data', (data) => { stdout += data.toString(); });
      docker.stderr.on('data', (data) => { stderr += data.toString(); });

      docker.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ output: stdout.trim() });
          }
        } else {
          reject(new Error(stderr || `Docker command failed with code ${code}`));
        }
      });

      docker.on('error', (err) => {
        reject(new Error(`Failed to execute Docker: ${err.message}`));
      });
    });
  }

  private async listContainers(args: any): Promise<any> {
    const cmdArgs = ['ps', '--format', 'json'];
    if (args.all) cmdArgs.push('-a');
    return await this.executeDockerCommand(cmdArgs);
  }

  private async getContainer(containerId: string): Promise<any> {
    return await this.executeDockerCommand(['inspect', containerId]);
  }

  private async startContainer(containerId: string): Promise<any> {
    await this.executeDockerCommand(['start', containerId]);
    return { success: true, containerId, action: 'started' };
  }

  private async stopContainer(containerId: string, timeout?: number): Promise<any> {
    const args = ['stop'];
    if (timeout) args.push('-t', timeout.toString());
    args.push(containerId);
    await this.executeDockerCommand(args);
    return { success: true, containerId, action: 'stopped' };
  }

  private async restartContainer(containerId: string, timeout?: number): Promise<any> {
    const args = ['restart'];
    if (timeout) args.push('-t', timeout.toString());
    args.push(containerId);
    await this.executeDockerCommand(args);
    return { success: true, containerId, action: 'restarted' };
  }

  private async containerLogs(args: any): Promise<any> {
    const cmdArgs = ['logs'];
    if (args.tail) cmdArgs.push('--tail', args.tail.toString());
    if (args.since) cmdArgs.push('--since', args.since);
    cmdArgs.push(args.containerId);
    return await this.executeDockerCommand(cmdArgs);
  }

  private async containerStats(containerId: string): Promise<any> {
    return await this.executeDockerCommand(['stats', '--no-stream', '--format', 'json', containerId]);
  }

  private async listImages(args: any): Promise<any> {
    const cmdArgs = ['images', '--format', 'json'];
    if (args.all) cmdArgs.push('-a');
    if (args.dangling) cmdArgs.push('--filter', 'dangling=true');
    return await this.executeDockerCommand(cmdArgs);
  }

  private async pullImage(image: string): Promise<any> {
    await this.executeDockerCommand(['pull', image]);
    return { success: true, image, action: 'pulled' };
  }

  private async removeImage(imageId: string, force?: boolean): Promise<any> {
    const args = ['rmi'];
    if (force) args.push('-f');
    args.push(imageId);
    await this.executeDockerCommand(args);
    return { success: true, imageId, action: 'removed' };
  }

  private async listVolumes(args: any): Promise<any> {
    const cmdArgs = ['volume', 'ls', '--format', 'json'];
    if (args.dangling) cmdArgs.push('--filter', 'dangling=true');
    return await this.executeDockerCommand(cmdArgs);
  }

  private async listNetworks(): Promise<any> {
    return await this.executeDockerCommand(['network', 'ls', '--format', 'json']);
  }

  private async dockerInfo(): Promise<any> {
    return await this.executeDockerCommand(['info', '--format', 'json']);
  }

  private async dockerPrune(type: string): Promise<any> {
    let args: string[];
    switch (type) {
      case 'containers':
        args = ['container', 'prune', '-f'];
        break;
      case 'images':
        args = ['image', 'prune', '-f'];
        break;
      case 'volumes':
        args = ['volume', 'prune', '-f'];
        break;
      case 'networks':
        args = ['network', 'prune', '-f'];
        break;
      case 'system':
        args = ['system', 'prune', '-f'];
        break;
      default:
        throw new Error(`Unknown prune type: ${type}`);
    }
    return await this.executeDockerCommand(args);
  }
}

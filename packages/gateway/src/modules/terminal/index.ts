import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import {
  ExecuteCommandArgsSchema,
  ProcessResult,
  MAX_COMMAND_TIMEOUT,
} from '../../shared/types.js';
import { Logger } from '../../shared/utils.js';

const execAsync = promisify(exec);
const logger = new Logger('terminal');

export interface TerminalConfig {
  allowedCommands?: string[];
  blockedCommands?: string[];
  maxTimeout?: number;
  allowedPaths?: string[];
}

export class TerminalModule {
  private runningProcesses = new Map<string, any>();

  constructor(private config: TerminalConfig = {}) {
    // Default blocked commands for security
    this.config.blockedCommands = this.config.blockedCommands || [
      'rm -rf /',
      'format',
      'fdisk',
      'mkfs',
      'dd',
      'shutdown',
      'reboot',
      'halt',
      'init',
      'sudo rm',
    ];
  }

  getTools() {
    return [
      {
        name: 'execute_command',
        description: 'Execute a shell command and return the result',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The command to execute' },
            args: {
              type: 'array',
              items: { type: 'string' },
              description: 'Command arguments (optional)',
            },
            workingDirectory: { type: 'string', description: 'Working directory (optional)' },
            timeout: { type: 'number', description: 'Timeout in milliseconds (optional)' },
          },
          required: ['command'],
        },
      },
      {
        name: 'start_process',
        description: 'Start a long-running process',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The command to start' },
            args: {
              type: 'array',
              items: { type: 'string' },
              description: 'Command arguments (optional)',
            },
            workingDirectory: { type: 'string', description: 'Working directory (optional)' },
            processId: { type: 'string', description: 'Unique process identifier' },
          },
          required: ['command', 'processId'],
        },
      },
      {
        name: 'stop_process',
        description: 'Stop a running process',
        inputSchema: {
          type: 'object',
          properties: {
            processId: { type: 'string', description: 'Process identifier to stop' },
          },
          required: ['processId'],
        },
      },
      {
        name: 'list_processes',
        description: 'List all running processes managed by this server',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_process_status',
        description: 'Get the status of a specific process',
        inputSchema: {
          type: 'object',
          properties: {
            processId: { type: 'string', description: 'Process identifier' },
          },
          required: ['processId'],
        },
      },
      {
        name: 'get_working_directory',
        description: 'Get the current working directory',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'change_directory',
        description: 'Change the working directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'New working directory path' },
          },
          required: ['path'],
        },
      },
      {
        name: 'get_environment_variable',
        description: 'Get an environment variable value',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Environment variable name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'set_environment_variable',
        description: 'Set an environment variable (for this session)',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Environment variable name' },
            value: { type: 'string', description: 'Environment variable value' },
          },
          required: ['name', 'value'],
        },
      },
      {
        name: 'list_environment_variables',
        description: 'List all environment variables',
        inputSchema: {
          type: 'object',
          properties: {
            filter: { type: 'string', description: 'Filter pattern (optional)' },
          },
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    logger.debug(`Handling terminal tool: ${name}`, args);

    try {
      switch (name) {
        case 'execute_command':
          return await this.executeCommand(ExecuteCommandArgsSchema.parse(args));
        case 'start_process':
          return await this.startProcess(args);
        case 'stop_process':
          return await this.stopProcess(args.processId);
        case 'list_processes':
          return await this.listProcesses();
        case 'get_process_status':
          return await this.getProcessStatus(args.processId);
        case 'get_working_directory':
          return await this.getWorkingDirectory();
        case 'change_directory':
          return await this.changeDirectory(args.path);
        case 'get_environment_variable':
          return await this.getEnvironmentVariable(args.name);
        case 'set_environment_variable':
          return await this.setEnvironmentVariable(args.name, args.value);
        case 'list_environment_variables':
          return await this.listEnvironmentVariables(args.filter);
        default:
          throw new Error(`Unknown terminal tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error in terminal tool ${name}:`, error);
      throw error;
    }
  }

  private validateCommand(command: string): void {
    // Check blocked commands
    if (this.config.blockedCommands?.some(blocked => command.includes(blocked))) {
      throw new Error(`Command blocked for security: ${command}`);
    }

    // Check allowed commands if specified
    if (this.config.allowedCommands && this.config.allowedCommands.length > 0) {
      const isAllowed = this.config.allowedCommands.some(allowed => command.startsWith(allowed));
      if (!isAllowed) {
        throw new Error(`Command not in allowed list: ${command}`);
      }
    }
  }

  private validatePath(workingDirectory?: string): string {
    if (!workingDirectory) {
      return process.cwd();
    }

    const resolvedPath = path.resolve(workingDirectory);

    // Check allowed paths if specified
    if (this.config.allowedPaths && this.config.allowedPaths.length > 0) {
      const isAllowed = this.config.allowedPaths.some(allowedPath =>
        resolvedPath.startsWith(path.resolve(allowedPath))
      );
      if (!isAllowed) {
        throw new Error(`Working directory not allowed: ${resolvedPath}`);
      }
    }

    return resolvedPath;
  }

  private async executeCommand(args: {
    command: string;
    args?: string[];
    workingDirectory?: string;
    timeout?: number;
  }): Promise<ProcessResult> {
    const fullCommand = args.args ? `${args.command} ${args.args.join(' ')}` : args.command;
    this.validateCommand(fullCommand);

    const cwd = this.validatePath(args.workingDirectory);
    const timeout = Math.min(args.timeout || MAX_COMMAND_TIMEOUT, this.config.maxTimeout || MAX_COMMAND_TIMEOUT);

    logger.info(`Executing command: ${fullCommand} in ${cwd}`);

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      const result: ProcessResult = {
        exitCode: 0,
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        command: fullCommand,
      };

      logger.debug(`Command completed successfully: ${fullCommand}`);
      return result;
    } catch (error: any) {
      const result: ProcessResult = {
        exitCode: error.code || 1,
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        command: fullCommand,
      };

      logger.warn(`Command failed: ${fullCommand}`, { exitCode: result.exitCode });
      return result;
    }
  }

  private async startProcess(args: {
    command: string;
    args?: string[];
    workingDirectory?: string;
    processId: string;
  }): Promise<{ success: boolean; processId: string; pid: number }> {
    if (this.runningProcesses.has(args.processId)) {
      throw new Error(`Process with ID '${args.processId}' already exists`);
    }

    this.validateCommand(args.command);
    const cwd = this.validatePath(args.workingDirectory);

    logger.info(`Starting process: ${args.command} (ID: ${args.processId})`);

    const childProcess = spawn(args.command, args.args || [], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const processInfo = {
      process: childProcess,
      command: args.command,
      args: args.args || [],
      startTime: new Date().toISOString(),
      status: 'running',
    };

    this.runningProcesses.set(args.processId, processInfo);

    childProcess.on('exit', (code) => {
      const info = this.runningProcesses.get(args.processId);
      if (info) {
        info.status = 'exited';
        info.exitCode = code;
        info.endTime = new Date().toISOString();
      }
      logger.info(`Process exited: ${args.processId} (code: ${code})`);
    });

    childProcess.on('error', (error) => {
      const info = this.runningProcesses.get(args.processId);
      if (info) {
        info.status = 'error';
        info.error = error.message;
      }
      logger.error(`Process error: ${args.processId}`, error);
    });

    return {
      success: true,
      processId: args.processId,
      pid: childProcess.pid!,
    };
  }

  private async stopProcess(processId: string): Promise<{ success: boolean }> {
    const processInfo = this.runningProcesses.get(processId);
    if (!processInfo) {
      throw new Error(`Process '${processId}' not found`);
    }

    if (processInfo.status !== 'running') {
      throw new Error(`Process '${processId}' is not running (status: ${processInfo.status})`);
    }

    logger.info(`Stopping process: ${processId}`);

    try {
      processInfo.process.kill('SIGTERM');

      // Wait a bit then force kill if necessary
      setTimeout(() => {
        if (processInfo.status === 'running') {
          processInfo.process.kill('SIGKILL');
        }
      }, 5000);

      return { success: true };
    } catch (error) {
      logger.error(`Failed to stop process: ${processId}`, error);
      throw new Error(`Failed to stop process: ${(error as Error).message}`);
    }
  }

  private async listProcesses(): Promise<{ processes: any[] }> {
    const processes = Array.from(this.runningProcesses.entries()).map(([id, info]) => ({
      processId: id,
      command: info.command,
      args: info.args,
      status: info.status,
      startTime: info.startTime,
      endTime: info.endTime,
      exitCode: info.exitCode,
      pid: info.process.pid,
    }));

    return { processes };
  }

  private async getProcessStatus(processId: string): Promise<{ process: any }> {
    const processInfo = this.runningProcesses.get(processId);
    if (!processInfo) {
      throw new Error(`Process '${processId}' not found`);
    }

    return {
      process: {
        processId,
        command: processInfo.command,
        args: processInfo.args,
        status: processInfo.status,
        startTime: processInfo.startTime,
        endTime: processInfo.endTime,
        exitCode: processInfo.exitCode,
        pid: processInfo.process.pid,
      },
    };
  }

  private async getWorkingDirectory(): Promise<{ path: string }> {
    return { path: process.cwd() };
  }

  private async changeDirectory(newPath: string): Promise<{ success: boolean; path: string }> {
    const validPath = this.validatePath(newPath);

    try {
      process.chdir(validPath);
      logger.info(`Changed working directory to: ${validPath}`);
      return { success: true, path: validPath };
    } catch (error) {
      throw new Error(`Failed to change directory: ${(error as Error).message}`);
    }
  }

  private async getEnvironmentVariable(name: string): Promise<{ name: string; value?: string }> {
    return {
      name,
      value: process.env[name] ?? undefined,
    };
  }

  private async setEnvironmentVariable(name: string, value: string): Promise<{ success: boolean }> {
    process.env[name] = value;
    logger.info(`Set environment variable: ${name}`);
    return { success: true };
  }

  private async listEnvironmentVariables(filter?: string): Promise<{ variables: Array<{ name: string; value: string }> }> {
    const variables = Object.entries(process.env)
      .filter(([name, value]) => {
        if (!filter) return true;
        return name.toLowerCase().includes(filter.toLowerCase());
      })
      .map(([name, value]) => ({ name, value: value || '' }));

    return { variables };
  }

  // Cleanup method to stop all running processes
  async cleanup(): Promise<void> {
    logger.info('Cleaning up running processes...');

    for (const [processId, processInfo] of this.runningProcesses.entries()) {
      if (processInfo.status === 'running') {
        try {
          await this.stopProcess(processId);
        } catch (error) {
          logger.error(`Failed to stop process during cleanup: ${processId}`, error);
        }
      }
    }
  }
}
// Linux Module - Linux system operations
// Supports Ubuntu, Debian, RedHat/CentOS, and other Linux distributions

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import { Logger } from '../../shared/utils.js';

const execAsync = promisify(exec);
const logger = new Logger('linux');

interface LinuxConfig {
  allowSudo?: boolean;
}

export class LinuxModule {
  private config: LinuxConfig;
  private isLinux: boolean;
  private distro: string = 'unknown';

  constructor(config: LinuxConfig = {}) {
    this.config = {
      allowSudo: config.allowSudo === true,
    };
    this.isLinux = process.platform === 'linux';

    if (this.isLinux) {
      this.detectDistro();
    } else {
      logger.warn('Linux module loaded on non-Linux platform - some features will be unavailable');
    }
  }

  private detectDistro(): void {
    try {
      if (existsSync('/etc/os-release')) {
        const osRelease = readFileSync('/etc/os-release', 'utf-8');
        const idMatch = osRelease.match(/^ID=(.*)$/m);
        if (idMatch && idMatch[1]) {
          this.distro = idMatch[1].replace(/"/g, '').toLowerCase();
        }
      } else if (existsSync('/etc/redhat-release')) {
        this.distro = 'rhel';
      } else if (existsSync('/etc/debian_version')) {
        this.distro = 'debian';
      }
      logger.info(`Detected Linux distribution: ${this.distro}`);
    } catch (error) {
      logger.warn('Could not detect Linux distribution');
    }
  }

  getTools() {
    return [
      {
        name: 'get_system_info',
        description: 'Get Linux system information (OS, kernel, hardware)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_distro_info',
        description: 'Get Linux distribution information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_services',
        description: 'List systemd services',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Service type filter (service, socket, target, etc.)' },
            state: { type: 'string', description: 'State filter (running, dead, failed, etc.)' },
          },
        },
      },
      {
        name: 'service_status',
        description: 'Get status of a systemd service',
        inputSchema: {
          type: 'object',
          properties: {
            service: { type: 'string', description: 'Service name' },
          },
          required: ['service'],
        },
      },
      {
        name: 'list_packages',
        description: 'List installed packages (apt/yum/dnf)',
        inputSchema: {
          type: 'object',
          properties: {
            filter: { type: 'string', description: 'Package name filter' },
          },
        },
      },
      {
        name: 'search_packages',
        description: 'Search for available packages',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_disk_usage',
        description: 'Get disk usage information',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to check (defaults to /)' },
          },
        },
      },
      {
        name: 'get_memory_info',
        description: 'Get memory usage information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_cpu_info',
        description: 'Get CPU information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_users',
        description: 'List system users',
        inputSchema: {
          type: 'object',
          properties: {
            showSystem: { type: 'boolean', description: 'Include system users' },
          },
        },
      },
      {
        name: 'list_processes',
        description: 'List running processes',
        inputSchema: {
          type: 'object',
          properties: {
            sortBy: { type: 'string', description: 'Sort by: cpu, mem, pid, time' },
            limit: { type: 'number', description: 'Number of processes to show' },
          },
        },
      },
      {
        name: 'get_network_info',
        description: 'Get network configuration',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_open_ports',
        description: 'List open network ports',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_uptime',
        description: 'Get system uptime and load average',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  private checkLinux(): void {
    if (!this.isLinux) {
      throw new Error('This tool is only available on Linux');
    }
  }

  private async runCommand(command: string): Promise<string> {
    try {
      const { stdout } = await execAsync(command, { timeout: 30000 });
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Command failed: ${error.message}`);
    }
  }

  private getPackageManager(): string {
    if (['ubuntu', 'debian', 'linuxmint', 'pop'].includes(this.distro)) {
      return 'apt';
    } else if (['rhel', 'centos', 'fedora', 'rocky', 'almalinux'].includes(this.distro)) {
      return existsSync('/usr/bin/dnf') ? 'dnf' : 'yum';
    } else if (this.distro === 'arch') {
      return 'pacman';
    } else if (this.distro === 'alpine') {
      return 'apk';
    }
    return 'apt'; // Default fallback
  }

  async handleTool(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case 'get_system_info': {
        this.checkLinux();
        const uname = await this.runCommand('uname -a');
        const hostname = await this.runCommand('hostname');
        const uptime = await this.runCommand('uptime -p').catch(() => 'unknown');
        return { kernel: uname, hostname, uptime };
      }

      case 'get_distro_info': {
        this.checkLinux();
        const osRelease = existsSync('/etc/os-release')
          ? await this.runCommand('cat /etc/os-release')
          : 'Not available';
        return { distro: this.distro, osRelease };
      }

      case 'list_services': {
        this.checkLinux();
        let cmd = 'systemctl list-units --type=service --no-pager';
        if (args['type']) cmd = `systemctl list-units --type=${args['type']} --no-pager`;
        if (args['state']) cmd += ` --state=${args['state']}`;
        const output = await this.runCommand(cmd);
        return { services: output };
      }

      case 'service_status': {
        this.checkLinux();
        const status = await this.runCommand(`systemctl status ${args['service']} --no-pager`);
        return { status };
      }

      case 'list_packages': {
        this.checkLinux();
        const pm = this.getPackageManager();
        let cmd: string;
        switch (pm) {
          case 'apt':
            cmd = args['filter'] ? `dpkg -l | grep "${args['filter']}"` : 'dpkg -l';
            break;
          case 'dnf':
          case 'yum':
            cmd = args['filter'] ? `${pm} list installed | grep "${args['filter']}"` : `${pm} list installed`;
            break;
          case 'pacman':
            cmd = args['filter'] ? `pacman -Q | grep "${args['filter']}"` : 'pacman -Q';
            break;
          case 'apk':
            cmd = args['filter'] ? `apk list --installed | grep "${args['filter']}"` : 'apk list --installed';
            break;
          default:
            cmd = 'echo "Unknown package manager"';
        }
        const output = await this.runCommand(cmd);
        return { packages: output };
      }

      case 'search_packages': {
        this.checkLinux();
        const pm = this.getPackageManager();
        let cmd: string;
        switch (pm) {
          case 'apt':
            cmd = `apt-cache search "${args['query']}"`;
            break;
          case 'dnf':
          case 'yum':
            cmd = `${pm} search "${args['query']}"`;
            break;
          case 'pacman':
            cmd = `pacman -Ss "${args['query']}"`;
            break;
          case 'apk':
            cmd = `apk search "${args['query']}"`;
            break;
          default:
            cmd = 'echo "Unknown package manager"';
        }
        const output = await this.runCommand(cmd);
        return { results: output };
      }

      case 'get_disk_usage': {
        this.checkLinux();
        const path = args['path'] || '/';
        const df = await this.runCommand(`df -h "${path}"`);
        return { usage: df };
      }

      case 'get_memory_info': {
        this.checkLinux();
        const free = await this.runCommand('free -h');
        return { memory: free };
      }

      case 'get_cpu_info': {
        this.checkLinux();
        const cpuInfo = await this.runCommand('lscpu');
        return { cpu: cpuInfo };
      }

      case 'list_users': {
        this.checkLinux();
        let cmd = 'getent passwd';
        if (!args['showSystem']) {
          cmd = "getent passwd | awk -F: '$3 >= 1000 && $3 < 65534'";
        }
        const users = await this.runCommand(cmd);
        return { users };
      }

      case 'list_processes': {
        this.checkLinux();
        const sortBy = args['sortBy'] || 'cpu';
        const limit = args['limit'] || 20;
        const sortMap: Record<string, string> = {
          cpu: '-%cpu',
          mem: '-%mem',
          pid: 'pid',
          time: '-time',
        };
        const sortFlag = sortMap[sortBy] || '-%cpu';
        const output = await this.runCommand(`ps aux --sort=${sortFlag} | head -n ${limit + 1}`);
        return { processes: output };
      }

      case 'get_network_info': {
        this.checkLinux();
        const ipAddr = await this.runCommand('ip addr show');
        const route = await this.runCommand('ip route');
        return { interfaces: ipAddr, routes: route };
      }

      case 'list_open_ports': {
        this.checkLinux();
        const ports = await this.runCommand('ss -tuln').catch(() =>
          this.runCommand('netstat -tuln')
        );
        return { ports };
      }

      case 'get_uptime': {
        this.checkLinux();
        const uptime = await this.runCommand('uptime');
        return { uptime };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

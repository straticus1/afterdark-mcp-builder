// macOS Module - Apple macOS system operations
// Uses macOS-specific commands and AppleScript for system management

import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../../shared/utils.js';

const execAsync = promisify(exec);
const logger = new Logger('macos');

interface MacOSConfig {
  allowAutomation?: boolean;
}

export class MacOSModule {
  private config: MacOSConfig;
  private isMacOS: boolean;

  constructor(config: MacOSConfig = {}) {
    this.config = {
      allowAutomation: config.allowAutomation !== false,
    };
    this.isMacOS = process.platform === 'darwin';

    if (!this.isMacOS) {
      logger.warn('macOS module loaded on non-macOS platform - some features will be unavailable');
    }
  }

  getTools() {
    return [
      {
        name: 'get_system_info',
        description: 'Get macOS system information (version, hardware, etc.)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_running_apps',
        description: 'List currently running applications',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'launch_app',
        description: 'Launch an application',
        inputSchema: {
          type: 'object',
          properties: {
            appName: { type: 'string', description: 'Application name (e.g., Safari, Finder)' },
          },
          required: ['appName'],
        },
      },
      {
        name: 'quit_app',
        description: 'Quit an application',
        inputSchema: {
          type: 'object',
          properties: {
            appName: { type: 'string', description: 'Application name' },
            force: { type: 'boolean', description: 'Force quit the application' },
          },
          required: ['appName'],
        },
      },
      {
        name: 'get_clipboard',
        description: 'Get current clipboard contents',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'set_clipboard',
        description: 'Set clipboard contents',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to copy to clipboard' },
          },
          required: ['text'],
        },
      },
      {
        name: 'list_disks',
        description: 'List mounted disks and volumes',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_battery_status',
        description: 'Get battery status and power information',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_network_info',
        description: 'Get network configuration and interfaces',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'speak_text',
        description: 'Use text-to-speech to speak text',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to speak' },
            voice: { type: 'string', description: 'Voice name (e.g., Alex, Samantha)' },
          },
          required: ['text'],
        },
      },
      {
        name: 'show_notification',
        description: 'Display a macOS notification',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Notification title' },
            message: { type: 'string', description: 'Notification message' },
            subtitle: { type: 'string', description: 'Notification subtitle' },
          },
          required: ['title', 'message'],
        },
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Output file path' },
            interactive: { type: 'boolean', description: 'Interactive selection mode' },
          },
        },
      },
      {
        name: 'open_url',
        description: 'Open a URL in the default browser',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to open' },
          },
          required: ['url'],
        },
      },
      {
        name: 'list_wifi_networks',
        description: 'List available Wi-Fi networks',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  private checkMacOS(): void {
    if (!this.isMacOS) {
      throw new Error('This tool is only available on macOS');
    }
  }

  private async runAppleScript(script: string): Promise<string> {
    this.checkMacOS();
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 30000 });
    return stdout.trim();
  }

  private async runCommand(command: string): Promise<string> {
    this.checkMacOS();
    const { stdout } = await execAsync(command, { timeout: 30000 });
    return stdout.trim();
  }

  async handleTool(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case 'get_system_info': {
        const swVersion = await this.runCommand('sw_vers');
        const hardware = await this.runCommand('system_profiler SPHardwareDataType -detailLevel mini');
        return { software: swVersion, hardware };
      }

      case 'list_running_apps': {
        const apps = await this.runAppleScript('tell application "System Events" to get name of every process whose background only is false');
        return { apps: apps.split(', ') };
      }

      case 'launch_app':
        await this.runAppleScript(`tell application "${args['appName']}" to activate`);
        return { success: true, app: args['appName'] };

      case 'quit_app': {
        const cmd = args['force'] ? 'quit' : 'quit saving no';
        await this.runAppleScript(`tell application "${args['appName']}" to ${cmd}`);
        return { success: true, app: args['appName'] };
      }

      case 'get_clipboard': {
        const content = await this.runCommand('pbpaste');
        return { content };
      }

      case 'set_clipboard':
        await this.runCommand(`echo "${args['text'].replace(/"/g, '\\"')}" | pbcopy`);
        return { success: true };

      case 'list_disks': {
        const disks = await this.runCommand('diskutil list -plist');
        return { output: disks };
      }

      case 'get_battery_status': {
        try {
          const battery = await this.runCommand('pmset -g batt');
          return { status: battery };
        } catch {
          return { status: 'No battery (desktop Mac)' };
        }
      }

      case 'get_network_info': {
        const interfaces = await this.runCommand('ifconfig');
        const wifi = await this.runCommand('networksetup -getinfo Wi-Fi').catch(() => 'Wi-Fi not available');
        return { interfaces, wifi };
      }

      case 'speak_text': {
        const voiceArg = args['voice'] ? `-v "${args['voice']}"` : '';
        await this.runCommand(`say ${voiceArg} "${args['text'].replace(/"/g, '\\"')}"`);
        return { success: true };
      }

      case 'show_notification': {
        const subtitle = args['subtitle'] ? `subtitle "${args['subtitle']}"` : '';
        await this.runAppleScript(
          `display notification "${args['message']}" with title "${args['title']}" ${subtitle}`
        );
        return { success: true };
      }

      case 'screenshot': {
        const path = args['path'] || `/tmp/screenshot_${Date.now()}.png`;
        const interactiveArg = args['interactive'] ? '-i' : '';
        await this.runCommand(`screencapture ${interactiveArg} "${path}"`);
        return { success: true, path };
      }

      case 'open_url':
        await this.runCommand(`open "${args['url']}"`);
        return { success: true, url: args['url'] };

      case 'list_wifi_networks': {
        try {
          const networks = await this.runCommand('/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -s');
          return { networks };
        } catch {
          return { error: 'Unable to scan Wi-Fi networks' };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

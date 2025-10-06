import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import { diffLines } from 'diff';
import {
  ReadFileArgsSchema,
  WriteFileArgsSchema,
  MoveFileArgsSchema,
  SearchFilesArgsSchema,
  FileInfo,
} from '../../shared/types.js';
import { safeReadFile, safeWriteFile, validatePath, Logger } from '../../shared/utils.js';

const logger = new Logger('filesystem');

export interface FilesystemConfig {
  allowedPaths?: string[];
  maxFileSize?: number;
}

export class FilesystemModule {
  constructor(private config: FilesystemConfig = {}) {}

  getTools() {
    return [
      {
        name: 'read_file',
        description: 'Read the complete contents of a file from the filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute or relative path to the file' },
          },
          required: ['path'],
        },
      },
      {
        name: 'write_file',
        description: 'Write content to a file, creating directories as needed',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Absolute or relative path to the file' },
            content: { type: 'string', description: 'Content to write to the file' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'create_directory',
        description: 'Create a new directory (and parent directories if needed)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path of the directory to create' },
          },
          required: ['path'],
        },
      },
      {
        name: 'list_directory',
        description: 'List contents of a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path of the directory to list' },
          },
          required: ['path'],
        },
      },
      {
        name: 'move_file',
        description: 'Move or rename a file or directory',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Source path' },
            destination: { type: 'string', description: 'Destination path' },
          },
          required: ['source', 'destination'],
        },
      },
      {
        name: 'delete_file',
        description: 'Delete a file or directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to delete' },
          },
          required: ['path'],
        },
      },
      {
        name: 'search_files',
        description: 'Search for files matching a pattern',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob pattern to search for' },
            path: { type: 'string', description: 'Directory to search in (optional)' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'get_file_info',
        description: 'Get detailed information about a file or directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to get info for' },
          },
          required: ['path'],
        },
      },
      {
        name: 'edit_file',
        description: 'Edit a file by replacing specific content',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file' },
            edits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  oldText: { type: 'string', description: 'Text to replace' },
                  newText: { type: 'string', description: 'Replacement text' },
                },
                required: ['oldText', 'newText'],
              },
            },
          },
          required: ['path', 'edits'],
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    logger.debug(`Handling tool: ${name}`, args);

    try {
      switch (name) {
        case 'read_file':
          return await this.readFile(ReadFileArgsSchema.parse(args));
        case 'write_file':
          return await this.writeFile(WriteFileArgsSchema.parse(args));
        case 'create_directory':
          return await this.createDirectory(args.path);
        case 'list_directory':
          return await this.listDirectory(args.path);
        case 'move_file':
          return await this.moveFile(MoveFileArgsSchema.parse(args));
        case 'delete_file':
          return await this.deleteFile(args.path);
        case 'search_files':
          return await this.searchFiles(SearchFilesArgsSchema.parse(args));
        case 'get_file_info':
          return await this.getFileInfo(args.path);
        case 'edit_file':
          return await this.editFile(args.path, args.edits);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error in ${name}:`, error);
      throw error;
    }
  }

  private async readFile(args: { path: string }): Promise<{ content: string }> {
    const content = await safeReadFile(args.path, this.config.allowedPaths);
    return { content };
  }

  private async writeFile(args: { path: string; content: string }): Promise<{ success: boolean }> {
    await safeWriteFile(args.path, args.content, this.config.allowedPaths);
    return { success: true };
  }

  private async createDirectory(dirPath: string): Promise<{ success: boolean }> {
    const validPath = validatePath(dirPath, this.config.allowedPaths);
    await fs.mkdir(validPath, { recursive: true });
    return { success: true };
  }

  private async listDirectory(dirPath: string): Promise<{ files: FileInfo[] }> {
    const validPath = validatePath(dirPath, this.config.allowedPaths);
    const entries = await fs.readdir(validPath, { withFileTypes: true });

    const files: FileInfo[] = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(validPath, entry.name);
        const stats = await fs.stat(fullPath);
        return {
          path: entry.name,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          type: entry.isDirectory() ? 'directory' : 'file',
        };
      })
    );

    return { files };
  }

  private async moveFile(args: { source: string; destination: string }): Promise<{ success: boolean }> {
    const sourcePath = validatePath(args.source, this.config.allowedPaths);
    const destPath = validatePath(args.destination, this.config.allowedPaths);

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.rename(sourcePath, destPath);

    return { success: true };
  }

  private async deleteFile(filePath: string): Promise<{ success: boolean }> {
    const validPath = validatePath(filePath, this.config.allowedPaths);
    const stats = await fs.stat(validPath);

    if (stats.isDirectory()) {
      await fs.rmdir(validPath, { recursive: true });
    } else {
      await fs.unlink(validPath);
    }

    return { success: true };
  }

  private async searchFiles(args: { pattern: string; path?: string }): Promise<{ files: string[] }> {
    const searchPath = args.path ?? process.cwd();
    const validPath = validatePath(searchPath, this.config.allowedPaths);

    const files = await glob(args.pattern, {
      cwd: validPath,
      absolute: true,
    });

    return { files };
  }

  private async getFileInfo(filePath: string): Promise<FileInfo> {
    const validPath = validatePath(filePath, this.config.allowedPaths);
    const stats = await fs.stat(validPath);

    return {
      path: validPath,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      type: stats.isDirectory() ? 'directory' : 'file',
    };
  }

  private async editFile(filePath: string, edits: Array<{ oldText: string; newText: string }>): Promise<{ success: boolean; diff?: string }> {
    const content = await safeReadFile(filePath, this.config.allowedPaths);
    let newContent = content;

    for (const edit of edits) {
      newContent = newContent.replace(edit.oldText, edit.newText);
    }

    await safeWriteFile(filePath, newContent, this.config.allowedPaths);

    const diff = diffLines(content, newContent)
      .map(part => (part.added ? '+' : part.removed ? '-' : ' ') + part.value)
      .join('');

    return { success: true, diff };
  }
}
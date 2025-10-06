import { promises as fs } from 'fs';
import path from 'path';
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_SIZE } from './types.js';

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates and normalizes a file path for security
 */
export function validatePath(filePath: string, allowedPaths?: string[]): string {
  const normalizedPath = path.resolve(filePath);

  // Check for path traversal attempts
  if (normalizedPath.includes('..')) {
    throw new SecurityError('Path traversal not allowed');
  }

  // Check against allowed paths if provided
  if (allowedPaths && allowedPaths.length > 0) {
    const isAllowed = allowedPaths.some(allowedPath =>
      normalizedPath.startsWith(path.resolve(allowedPath))
    );
    if (!isAllowed) {
      throw new SecurityError(`Access denied to path: ${normalizedPath}`);
    }
  }

  return normalizedPath;
}

/**
 * Validates file extension for security
 */
export function validateFileExtension(filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
    throw new SecurityError(`File extension not allowed: ${ext}`);
  }
}

/**
 * Validates file size
 */
export async function validateFileSize(filePath: string): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new ValidationError(`File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`);
    }
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    // File doesn't exist yet, which is okay for write operations
  }
}

/**
 * Safely reads a file with validation
 */
export async function safeReadFile(filePath: string, allowedPaths?: string[]): Promise<string> {
  const validPath = validatePath(filePath, allowedPaths);
  validateFileExtension(validPath);
  await validateFileSize(validPath);

  try {
    return await fs.readFile(validPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file: ${(error as Error).message}`);
  }
}

/**
 * Safely writes a file with validation
 */
export async function safeWriteFile(
  filePath: string,
  content: string,
  allowedPaths?: string[]
): Promise<void> {
  const validPath = validatePath(filePath, allowedPaths);
  validateFileExtension(validPath);

  // Ensure directory exists
  await fs.mkdir(path.dirname(validPath), { recursive: true });

  try {
    await fs.writeFile(validPath, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write file: ${(error as Error).message}`);
  }
}

/**
 * Formats file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Debounce function for rate limiting
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Simple logger with levels
 */
export class Logger {
  constructor(private name: string) {}

  info(message: string, ...args: any[]): void {
    console.log(`[${new Date().toISOString()}] [${this.name}] INFO:`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${new Date().toISOString()}] [${this.name}] WARN:`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${new Date().toISOString()}] [${this.name}] ERROR:`, message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (process.env['DEBUG']) {
      console.debug(`[${new Date().toISOString()}] [${this.name}] DEBUG:`, message, ...args);
    }
  }
}
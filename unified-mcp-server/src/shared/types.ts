import { z } from 'zod';

// Common schemas for all modules
export const PathSchema = z.string().min(1);
export const ContentSchema = z.string();
export const MimeTypeSchema = z.string().optional();

// Filesystem schemas
export const ReadFileArgsSchema = z.object({
  path: PathSchema,
});

export const WriteFileArgsSchema = z.object({
  path: PathSchema,
  content: ContentSchema,
});

export const MoveFileArgsSchema = z.object({
  source: PathSchema,
  destination: PathSchema,
});

export const SearchFilesArgsSchema = z.object({
  pattern: z.string(),
  path: PathSchema.optional(),
});

// Memory/Knowledge Graph schemas
export const EntitySchema = z.object({
  name: z.string(),
  entityType: z.string(),
  observations: z.array(z.string()),
});

export const RelationSchema = z.object({
  from: z.string(),
  to: z.string(),
  relationType: z.string(),
});

export const CreateEntityArgsSchema = z.object({
  name: z.string(),
  entityType: z.string(),
  observations: z.array(z.string()).optional().default([]),
});

export const CreateRelationArgsSchema = z.object({
  from: z.string(),
  to: z.string(),
  relationType: z.string(),
});

// Terminal/Process schemas
export const ExecuteCommandArgsSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  workingDirectory: z.string().optional(),
  timeout: z.number().optional(),
});

// Browser automation schemas
export const NavigateArgsSchema = z.object({
  url: z.string().url(),
});

export const ClickElementArgsSchema = z.object({
  selector: z.string(),
});

export const TypeTextArgsSchema = z.object({
  selector: z.string(),
  text: z.string(),
});

// Common response types
export interface FileInfo {
  path: string;
  size: number;
  modified: string;
  type: 'file' | 'directory';
}

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
}

export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt: string;
}

// Security and validation
export const ALLOWED_FILE_EXTENSIONS = [
  '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx',
  '.py', '.java', '.cpp', '.c', '.h', '.css', '.html',
  '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf'
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_COMMAND_TIMEOUT = 30000; // 30 seconds
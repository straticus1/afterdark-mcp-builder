/**
 * GitHub Module
 * Provides tools for managing GitHub repositories, issues, and pull requests
 */

import { Logger } from '../../shared/utils.js';

const logger = new Logger('github');

export interface GitHubConfig {
  token?: string;
}

interface GitHubClient {
  token: string;
  configured: boolean;
  baseUrl: string;
}

export class GitHubModule {
  private client: GitHubClient;

  constructor(config: GitHubConfig = {}) {
    this.client = {
      token: config.token || process.env['GITHUB_TOKEN'] || '',
      configured: !!(config.token || process.env['GITHUB_TOKEN']),
      baseUrl: 'https://api.github.com',
    };

    if (this.client.configured) {
      logger.info('GitHub module initialized');
    } else {
      logger.warn('GitHub token not configured');
    }
  }

  getTools() {
    return [
      // Repository Tools
      {
        name: 'list_repos',
        description: 'List repositories for the authenticated user or an organization',
        inputSchema: {
          type: 'object',
          properties: {
            org: { type: 'string', description: 'Organization name (optional)' },
            type: { type: 'string', description: 'Type: all, public, private, forks, sources, member' },
            sort: { type: 'string', description: 'Sort by: created, updated, pushed, full_name' },
          },
        },
      },
      {
        name: 'get_repo',
        description: 'Get repository details',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'create_repo',
        description: 'Create a new repository',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Repository name' },
            description: { type: 'string', description: 'Repository description' },
            private: { type: 'boolean', description: 'Create as private repository' },
            autoInit: { type: 'boolean', description: 'Initialize with README' },
          },
          required: ['name'],
        },
      },
      // Issue Tools
      {
        name: 'list_issues',
        description: 'List issues for a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            state: { type: 'string', description: 'State: open, closed, all' },
            labels: { type: 'string', description: 'Comma-separated label names' },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'create_issue',
        description: 'Create a new issue',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            title: { type: 'string', description: 'Issue title' },
            body: { type: 'string', description: 'Issue body' },
            labels: { type: 'array', items: { type: 'string' }, description: 'Labels to add' },
            assignees: { type: 'array', items: { type: 'string' }, description: 'Assignees' },
          },
          required: ['owner', 'repo', 'title'],
        },
      },
      {
        name: 'update_issue',
        description: 'Update an issue',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            issueNumber: { type: 'number', description: 'Issue number' },
            title: { type: 'string', description: 'New title' },
            body: { type: 'string', description: 'New body' },
            state: { type: 'string', description: 'State: open, closed' },
          },
          required: ['owner', 'repo', 'issueNumber'],
        },
      },
      // Pull Request Tools
      {
        name: 'list_pull_requests',
        description: 'List pull requests for a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            state: { type: 'string', description: 'State: open, closed, all' },
            base: { type: 'string', description: 'Base branch filter' },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'get_pull_request',
        description: 'Get pull request details',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            pullNumber: { type: 'number', description: 'Pull request number' },
          },
          required: ['owner', 'repo', 'pullNumber'],
        },
      },
      {
        name: 'create_pull_request',
        description: 'Create a new pull request',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            title: { type: 'string', description: 'PR title' },
            body: { type: 'string', description: 'PR body' },
            head: { type: 'string', description: 'Head branch' },
            base: { type: 'string', description: 'Base branch' },
            draft: { type: 'boolean', description: 'Create as draft' },
          },
          required: ['owner', 'repo', 'title', 'head', 'base'],
        },
      },
      // Branch Tools
      {
        name: 'list_branches',
        description: 'List branches for a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
          },
          required: ['owner', 'repo'],
        },
      },
      // Workflow Tools
      {
        name: 'list_workflows',
        description: 'List GitHub Actions workflows',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
          },
          required: ['owner', 'repo'],
        },
      },
      {
        name: 'trigger_workflow',
        description: 'Trigger a workflow dispatch event',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            workflowId: { type: 'string', description: 'Workflow ID or filename' },
            ref: { type: 'string', description: 'Branch or tag ref' },
            inputs: { type: 'object', description: 'Workflow inputs' },
          },
          required: ['owner', 'repo', 'workflowId', 'ref'],
        },
      },
    ];
  }

  async handleTool(name: string, args: any): Promise<any> {
    logger.debug(`Handling GitHub tool: ${name}`, args);

    if (!this.client.configured) {
      return {
        error: 'GitHub not configured',
        message: 'Please set GITHUB_TOKEN environment variable',
      };
    }

    try {
      switch (name) {
        case 'list_repos':
          return await this.listRepos(args);
        case 'get_repo':
          return await this.getRepo(args.owner, args.repo);
        case 'create_repo':
          return await this.createRepo(args);
        case 'list_issues':
          return await this.listIssues(args);
        case 'create_issue':
          return await this.createIssue(args);
        case 'update_issue':
          return await this.updateIssue(args);
        case 'list_pull_requests':
          return await this.listPullRequests(args);
        case 'get_pull_request':
          return await this.getPullRequest(args);
        case 'create_pull_request':
          return await this.createPullRequest(args);
        case 'list_branches':
          return await this.listBranches(args.owner, args.repo);
        case 'list_workflows':
          return await this.listWorkflows(args.owner, args.repo);
        case 'trigger_workflow':
          return await this.triggerWorkflow(args);
        default:
          throw new Error(`Unknown GitHub tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error in GitHub ${name}:`, error);
      throw error;
    }
  }

  private async ghFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.client.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.client.token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return await response.json();
  }

  private async listRepos(args: any): Promise<any> {
    let endpoint = args.org ? `/orgs/${args.org}/repos` : '/user/repos';
    const params = new URLSearchParams();
    if (args.type) params.set('type', args.type);
    if (args.sort) params.set('sort', args.sort);
    if (params.toString()) endpoint += `?${params.toString()}`;
    return await this.ghFetch(endpoint);
  }

  private async getRepo(owner: string, repo: string): Promise<any> {
    return await this.ghFetch(`/repos/${owner}/${repo}`);
  }

  private async createRepo(args: any): Promise<any> {
    return await this.ghFetch('/user/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: args.name,
        description: args.description,
        private: args.private ?? false,
        auto_init: args.autoInit ?? false,
      }),
    });
  }

  private async listIssues(args: any): Promise<any> {
    let endpoint = `/repos/${args.owner}/${args.repo}/issues`;
    const params = new URLSearchParams();
    if (args.state) params.set('state', args.state);
    if (args.labels) params.set('labels', args.labels);
    if (params.toString()) endpoint += `?${params.toString()}`;
    return await this.ghFetch(endpoint);
  }

  private async createIssue(args: any): Promise<any> {
    return await this.ghFetch(`/repos/${args.owner}/${args.repo}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: args.title,
        body: args.body,
        labels: args.labels,
        assignees: args.assignees,
      }),
    });
  }

  private async updateIssue(args: any): Promise<any> {
    const body: any = {};
    if (args.title) body.title = args.title;
    if (args.body) body.body = args.body;
    if (args.state) body.state = args.state;

    return await this.ghFetch(`/repos/${args.owner}/${args.repo}/issues/${args.issueNumber}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async listPullRequests(args: any): Promise<any> {
    let endpoint = `/repos/${args.owner}/${args.repo}/pulls`;
    const params = new URLSearchParams();
    if (args.state) params.set('state', args.state);
    if (args.base) params.set('base', args.base);
    if (params.toString()) endpoint += `?${params.toString()}`;
    return await this.ghFetch(endpoint);
  }

  private async getPullRequest(args: any): Promise<any> {
    return await this.ghFetch(`/repos/${args.owner}/${args.repo}/pulls/${args.pullNumber}`);
  }

  private async createPullRequest(args: any): Promise<any> {
    return await this.ghFetch(`/repos/${args.owner}/${args.repo}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: args.title,
        body: args.body,
        head: args.head,
        base: args.base,
        draft: args.draft ?? false,
      }),
    });
  }

  private async listBranches(owner: string, repo: string): Promise<any> {
    return await this.ghFetch(`/repos/${owner}/${repo}/branches`);
  }

  private async listWorkflows(owner: string, repo: string): Promise<any> {
    return await this.ghFetch(`/repos/${owner}/${repo}/actions/workflows`);
  }

  private async triggerWorkflow(args: any): Promise<any> {
    return await this.ghFetch(`/repos/${args.owner}/${args.repo}/actions/workflows/${args.workflowId}/dispatches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref: args.ref,
        inputs: args.inputs || {},
      }),
    });
  }
}

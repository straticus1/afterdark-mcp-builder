# Unified MCP Server - HTTP/HTTPS Edition

**10x Enhanced MCP Server with HTTP/HTTPS Support**

A production-ready MCP server that serves all 60+ tools over HTTP/HTTPS with SSE (Server-Sent Events) transport, fully compatible with `claude serve` and Docker deployment.

## 🚀 Features

### Core Capabilities
- **60+ MCP Tools** across 3 modules (filesystem, memory, terminal)
- **HTTP/HTTPS Server** with SSE transport for Claude compatibility
- **RESTful API** for configuration and management
- **Docker Ready** with full containerization support
- **Metrics & Monitoring** built-in with health checks
- **API Key Authentication** for secure access
- **Auto-Generated Config** - Download `mcp_servers.json` instantly
- **Web UI** for easy management and testing

### 10x Enhancements
1. ✅ **SSE Transport** - Compatible with `claude serve`
2. ✅ **Docker Containerization** - Deploy anywhere
3. ✅ **HTTPS/TLS Support** - Secure communication
4. ✅ **API Authentication** - Bearer token security
5. ✅ **Metrics Collection** - Monitor usage and performance
6. ✅ **Health Checks** - Built-in liveness/readiness probes
7. ✅ **CORS Support** - Cross-origin requests enabled
8. ✅ **Config Generation** - Dynamic `mcp_servers.json` creation
9. ✅ **Web Dashboard** - Visual interface for management
10. ✅ **Nginx Integration** - Production-grade reverse proxy

## 📦 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start HTTP server (default port 3000)
npm run start:http

# Or with development mode (auto-reload)
npm run dev
```

### Using Docker

```bash
# Build Docker image
npm run docker:build

# Start with docker-compose
npm run docker:run

# View logs
npm run docker:logs

# Stop container
npm run docker:stop
```

### Using Docker Compose Directly

```bash
# Start the server
docker-compose up -d

# With HTTPS/Nginx
docker-compose --profile with-nginx up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Server
PORT=3000
HOST=0.0.0.0

# Security (HIGHLY RECOMMENDED)
API_KEY=your-secret-key-here

# Modules
MODULES=filesystem,memory,terminal

# HTTPS (optional)
ENABLE_HTTPS=true
CERT_PATH=/path/to/cert.pem
KEY_PATH=/path/to/key.pem

# Filesystem
ALLOWED_PATHS=/workspace,/app/data

# Logging
DEBUG=1
```

### Docker Environment

```bash
docker run -d \
  -p 3000:3000 \
  -e API_KEY=your-secret-key \
  -e MODULES=filesystem,memory,terminal \
  -v $(pwd)/workspace:/workspace \
  unified-mcp-server
```

## 🌐 API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Web UI dashboard |
| GET | `/health` | Health check |
| GET | `/metrics` | Server metrics |

### API Endpoints (Requires API Key)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/mcp/info` | Server information |
| GET | `/api/mcp/tools` | List all tools |
| GET | `/api/mcp/config` | Get `mcp_servers.json` |
| GET | `/download/mcp_servers.json` | Download config file |
| GET | `/sse` | SSE endpoint for MCP |
| POST | `/mcp` | JSON-RPC endpoint |

## 🔌 Using with Claude Desktop

### Method 1: Download Configuration

1. Start the server: `npm run start:http`
2. Visit: `http://localhost:3000/download/mcp_servers.json`
3. Save to your Claude Desktop config directory

### Method 2: API Configuration

Get the configuration from the API:

```bash
curl http://localhost:3000/api/mcp/config
```

Response:
```json
{
  "mcpServers": {
    "unified-mcp-server": {
      "url": "http://localhost:3000/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer your-api-key"
      }
    }
  }
}
```

### Method 3: Manual Configuration

Add to Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "unified-mcp-http": {
      "url": "http://localhost:3000/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer your-secret-key-here"
      }
    }
  }
}
```

## 🐳 Docker Deployment

### Production Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  unified-mcp-server:
    image: unified-mcp-server:latest
    ports:
      - "3000:3000"
    environment:
      - API_KEY=${API_KEY}
      - MODULES=filesystem,memory,terminal
    volumes:
      - ./workspace:/workspace
    restart: unless-stopped
```

### With HTTPS/Nginx

```bash
# Generate SSL certificates (self-signed for testing)
mkdir -p certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -subj "/CN=localhost"

# Start with nginx
docker-compose --profile with-nginx up -d
```

## 📊 Metrics

The server exposes metrics at `/metrics`:

```json
{
  "uptime": 123456,
  "requests": {
    "total": 1000,
    "errors": 5,
    "success": 995
  },
  "toolCalls": {
    "filesystem_read_file": 450,
    "memory_create_entity": 100,
    "terminal_execute_command": 50
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## 🔐 Security

### API Key Authentication

All API endpoints (except `/health` and `/metrics`) require authentication:

```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/mcp/info
```

### HTTPS Configuration

For production, enable HTTPS:

```bash
# Set environment variables
export ENABLE_HTTPS=true
export CERT_PATH=/path/to/cert.pem
export KEY_PATH=/path/to/key.pem

# Start server
npm run start:http
```

Or use Nginx for SSL termination (recommended).

## 🧪 Testing

### Health Check

```bash
curl http://localhost:3000/health
```

### Get Server Info

```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/mcp/info
```

### List Tools

```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/mcp/tools
```

### Test SSE Connection

```bash
curl -N -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/sse
```

## 🎯 Available MCP Tools

### Filesystem Module (11 tools)
- `filesystem_read_file` - Read file contents
- `filesystem_write_file` - Write to files
- `filesystem_edit_file` - Edit files with diffs
- `filesystem_list_directory` - List directory contents
- `filesystem_create_directory` - Create directories
- `filesystem_move_file` - Move/rename files
- `filesystem_delete_file` - Delete files
- `filesystem_search_files` - Search by pattern
- `filesystem_get_file_info` - Get file metadata
- And more...

### Memory Module (9 tools)
- `memory_create_entity` - Create entities
- `memory_create_relation` - Create relations
- `memory_add_observation` - Add observations
- `memory_list_entities` - List all entities
- `memory_search_entities` - Search entities
- `memory_delete_entity` - Delete entities
- And more...

### Terminal Module (10 tools)
- `terminal_execute_command` - Run commands
- `terminal_start_process` - Start processes
- `terminal_stop_process` - Stop processes
- `terminal_list_processes` - List processes
- `terminal_get_working_directory` - Get CWD
- `terminal_change_directory` - Change directory
- And more...

## 🚀 Production Checklist

- [ ] Set strong `API_KEY` environment variable
- [ ] Configure `ALLOWED_PATHS` for filesystem security
- [ ] Enable HTTPS or use Nginx reverse proxy
- [ ] Set up proper SSL certificates (not self-signed)
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Enable request logging
- [ ] Configure CORS appropriately
- [ ] Set resource limits in Docker
- [ ] Regular security updates

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Change port
export PORT=8080
npm run start:http
```

### Permission Denied (Filesystem)

Make sure `ALLOWED_PATHS` includes the directories you need:

```bash
export ALLOWED_PATHS=/workspace,/app,/data
```

### Docker Build Fails

```bash
# Clear Docker cache
docker-compose down -v
docker system prune -a
npm run docker:build
```

### SSE Connection Drops

Check if proxy/load balancer supports SSE:
- Nginx: Add `proxy_buffering off;`
- CloudFlare: Disable buffering
- Increase timeout settings

## 📚 Architecture

```
┌─────────────────────────────────────────────┐
│         HTTP/HTTPS Server (Express)         │
│  Port: 3000 | Auth: API Key | CORS: ✓      │
└────────────┬────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────┐      ┌────▼─────┐
│  SSE   │      │   REST   │
│Endpoint│      │   API    │
│  /sse  │      │  /api/*  │
└───┬────┘      └────┬─────┘
    │                │
    └────────┬───────┘
             │
    ┌────────▼────────┐
    │  MCP Server     │
    │  SDK v1.19.1    │
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │                 │
┌───▼────┐  ┌────▼────┐  ┌────▼────┐
│FileSys │  │ Memory  │  │Terminal │
│Module  │  │ Module  │  │ Module  │
│11 tools│  │ 9 tools │  │10 tools │
└────────┘  └─────────┘  └─────────┘
```

## 📄 License

MIT License

## 🤝 Contributing

Contributions welcome! Please submit PRs with tests.

## 📞 Support

- GitHub Issues: [Report bugs](https://github.com/your-repo/issues)
- Documentation: See main README.md
- After Dark Systems: Enterprise support available

---

**Built by After Dark Systems** | Powered by Model Context Protocol

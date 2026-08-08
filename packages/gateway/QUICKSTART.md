# 🚀 Quick Start Guide - Unified MCP HTTP Server

Get up and running in **under 2 minutes**!

## ⚡ Instant Start (Local)

```bash
# 1. Build the project
npm run build

# 2. Start HTTP server (no auth for testing)
npm run start:http
```

**Server running at:** http://localhost:3000

Open in browser: http://localhost:3000

## 🔐 Secure Start (With API Key)

```bash
# 1. Set API key
export API_KEY="my-secret-key-123"

# 2. Start server
npm run start:http
```

**Test with curl:**
```bash
curl -H "Authorization: Bearer my-secret-key-123" \
  http://localhost:3000/api/mcp/info
```

## 🐳 Docker Start (Production-Ready)

```bash
# 1. Build Docker image
docker build -t unified-mcp-server .

# 2. Run container
docker run -d \
  -p 3000:3000 \
  -e API_KEY=my-secret-key \
  unified-mcp-server

# 3. Check logs
docker logs -f <container-id>
```

## 🎯 Quick Test

### 1. Check Health
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "modules": ["filesystem", "memory", "terminal"],
  "connections": 0
}
```

### 2. Get Server Info
```bash
curl http://localhost:3000/api/mcp/info
```

### 3. List All Tools
```bash
curl http://localhost:3000/api/mcp/tools | jq
```

### 4. Download Config for Claude
```bash
curl http://localhost:3000/download/mcp_servers.json > mcp_servers.json
```

## 🔌 Connect to Claude Desktop

### Option 1: Auto-Config

1. Visit: http://localhost:3000/api/mcp/config
2. Copy the JSON response
3. Paste into your Claude Desktop config

### Option 2: Manual Config

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "unified-mcp-http": {
      "url": "http://localhost:3000/sse",
      "transport": "sse"
    }
  }
}
```

**With API Key:**
```json
{
  "mcpServers": {
    "unified-mcp-http": {
      "url": "http://localhost:3000/sse",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer my-secret-key-123"
      }
    }
  }
}
```

### Option 3: Download File

```bash
# Download the config file
curl -o mcp_servers.json http://localhost:3000/download/mcp_servers.json

# Move to Claude config location (macOS)
mv mcp_servers.json ~/Library/Application\ Support/Claude/
```

## 🌐 Available Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Web UI Dashboard |
| `GET /health` | Health check |
| `GET /metrics` | Server metrics |
| `GET /api/mcp/info` | Server info |
| `GET /api/mcp/tools` | List all tools |
| `GET /api/mcp/config` | Get mcp_servers.json |
| `GET /download/mcp_servers.json` | Download config file |
| `GET /sse` | SSE endpoint for Claude |
| `POST /mcp` | JSON-RPC endpoint |

## 🎨 Try the Web UI

Open your browser: http://localhost:3000

Features:
- ✅ Interactive dashboard
- ✅ Download config file with one click
- ✅ View all endpoints
- ✅ Copy-paste configuration examples
- ✅ Docker deployment instructions

## 🔧 Configuration

### Environment Variables

```bash
# Server
export PORT=3000
export HOST=0.0.0.0

# Security
export API_KEY=your-secret-key

# Modules (choose which to enable)
export MODULES=filesystem,memory,terminal

# Debug logging
export DEBUG=1
```

### Custom Port

```bash
PORT=8080 npm run start:http
```

### Enable HTTPS

```bash
export ENABLE_HTTPS=true
export CERT_PATH=/path/to/cert.pem
export KEY_PATH=/path/to/key.pem

npm run start:http
```

## 🐳 Docker Compose (Recommended)

```bash
# 1. Create .env file
cat > .env << EOF
API_KEY=my-super-secret-key
MODULES=filesystem,memory,terminal
PORT=3000
EOF

# 2. Start with docker-compose
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Stop
docker-compose down
```

## 🧪 Test MCP Communication

### Test SSE Connection
```bash
# This should stream events
curl -N http://localhost:3000/sse
```

### Call a Tool (JSON-RPC)
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-key-123" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

## 📊 View Metrics

```bash
curl http://localhost:3000/metrics | jq
```

Example output:
```json
{
  "uptime": 123456,
  "requests": {
    "total": 100,
    "errors": 2,
    "success": 98
  },
  "toolCalls": {
    "filesystem_read_file": 50,
    "memory_create_entity": 30
  }
}
```

## 🎯 Available MCP Tools

Quick reference:

**Filesystem (11 tools):**
- `filesystem_read_file`
- `filesystem_write_file`
- `filesystem_list_directory`
- `filesystem_create_directory`
- `filesystem_move_file`
- `filesystem_delete_file`
- `filesystem_search_files`
- `filesystem_get_file_info`
- `filesystem_edit_file`
- And more...

**Memory (9 tools):**
- `memory_create_entity`
- `memory_create_relation`
- `memory_add_observation`
- `memory_list_entities`
- `memory_search_entities`
- `memory_delete_entity`
- And more...

**Terminal (10 tools):**
- `terminal_execute_command`
- `terminal_start_process`
- `terminal_list_processes`
- `terminal_get_working_directory`
- And more...

## 🚨 Troubleshooting

### Port already in use
```bash
# Use different port
PORT=8080 npm run start:http
```

### Build fails
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### Permission denied
```bash
# Make sure you have write access to workspace
mkdir -p workspace
chmod 755 workspace
```

### Docker issues
```bash
# Reset Docker
docker-compose down -v
docker system prune -a
docker-compose up -d
```

## 📚 Next Steps

1. **Security:** Set a strong `API_KEY`
2. **Production:** Use HTTPS with valid certificates
3. **Customize:** Configure `ALLOWED_PATHS` for filesystem
4. **Monitor:** Set up alerting on `/metrics` endpoint
5. **Scale:** Deploy with Kubernetes or Docker Swarm

## 🆘 Need Help?

- **Documentation:** See `README-HTTP.md`
- **Examples:** Check the web UI at http://localhost:3000
- **Issues:** Report bugs on GitHub
- **Support:** Contact After Dark Systems

---

**Happy coding!** 🎉

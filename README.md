# AfterDark MCP Builder

A comprehensive MCP (Model Context Protocol) server builder and integration toolkit developed by After Dark Systems.

## Overview

AfterDark MCP Builder is a unified development environment for creating, integrating, and managing multiple MCP servers. This project consolidates capabilities from 8+ different MCP servers into a single, powerful, and modular solution.

## Project Structure

This repository contains multiple MCP server implementations and a unified framework:

```
afterdark-mcp-builder/
├── awesome-mcp-servers/          # Curated MCP server collection
├── chrome-devtools-mcp/          # Browser debugging capabilities
├── claude-flow/                  # Claude integration flows
├── context7/                     # Documentation access tools
├── desktopcommandermcp/          # Terminal automation server
├── dwilcox-universal-agent-mcp-kit/  # Base framework (private)
├── fonoster/                     # Telephony platform integration
├── gpt-researcher/               # Research automation tools
├── mcp-chrome/                   # Chrome browser automation
├── mcp-servers/                  # Official MCP server implementations
├── openmetadata/                 # Data catalog integration
├── unified-mcp-server/           # Consolidated unified server (private)
├── universal-agent-mcp-kit/      # Symlink to base framework
├── zen-mcp-server/              # Zen productivity server
├── AFTERDARK_SYSTEMS_OVERHUAL_V1.md  # Technical documentation
├── CHANGELOG.md                  # Version history
└── README.md                     # This file
```

## Key Features

### 🚀 **Unified Server Architecture**
- **60+ Tools**: Consolidated capabilities from multiple MCP servers
- **Modular Design**: Load only the modules you need
- **Security-First**: Comprehensive validation and protection mechanisms
- **Performance Optimized**: Concurrent execution and intelligent caching

### 🔧 **Core Capabilities**
- **File Operations**: Advanced file system management (11 tools)
- **Memory Management**: Knowledge graph and entity management (9 tools)
- **Terminal Control**: Process and command automation (15+ tools)
- **Browser Automation**: Chrome control and DOM manipulation (25+ tools)
- **Documentation**: Context-aware documentation access (2 tools)
- **Testing**: MCP protocol testing and validation (12+ tools)

### 🛡️ **Security Framework**
- Path traversal protection
- File extension validation
- File size limits (configurable)
- Command timeout controls
- Allowed path restrictions

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- TypeScript >= 5.8.2
- Chrome/Chromium (for browser automation)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd afterdark-mcp-builder

# Install dependencies for each component
npm install

# Build the unified server
npm run build
```

### Basic Configuration

Create a configuration file:

```json
{
  "server": "unified-mcp-server",
  "modules": ["filesystem", "memory", "terminal"],
  "security": {
    "allowedPaths": ["/workspace"],
    "maxFileSize": "10MB",
    "commandTimeout": 30000
  }
}
```

### Running the Server

```bash
# Start the unified MCP server
npm start

# Or run specific modules
npm run start:filesystem
npm run start:browser
```

## Architecture

The AfterDark MCP Builder uses a "frankenstein methodology" - strategically extracting and integrating components from existing MCP servers:

### Base Framework
- **dwilcox-universal-agent-mcp-kit**: Core architectural foundation
- **Universal Agent Patterns**: Modular design and agent management

### Integrated Components
- **Official Anthropic Servers**: filesystem, memory, everything servers
- **Third-Party Servers**: desktop-commander, chrome automation, documentation tools
- **Custom Extensions**: Enhanced security, performance optimizations

## Performance Metrics

- **Startup Time**: < 2 seconds
- **Memory Usage**: ~50MB base + loaded modules
- **Tool Response Time**: < 100ms average
- **Concurrent Operations**: 50+ simultaneous tools

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Build all components
npm run build

# Run tests
npm test

# Development mode with hot reload
npm run dev
```

### Adding New Modules

1. Create module directory in `unified-mcp-server/src/modules/`
2. Implement module interface
3. Register module in main server configuration
4. Update documentation and tests

## Security Considerations

This toolkit handles sensitive operations including:
- File system access
- Terminal command execution
- Browser automation
- Network requests

Always review and configure security settings appropriate for your environment.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is developed by After Dark Systems. See individual component licenses for specific terms.

## Support

For technical support and questions:
- **Project Lead**: Ryan Coleman (After Dark Systems)
- **Documentation**: See `AFTERDARK_SYSTEMS_OVERHUAL_V1.md`
- **Issues**: Report via GitHub Issues

## Roadmap

### Phase 2 Enhancements
- WebSocket transport optimization
- Advanced caching strategies
- Plugin architecture for custom modules
- Distributed deployment capabilities

### Phase 3 Expansion
- AI-powered tool orchestration
- Advanced analytics and reporting
- Integration with After Dark Systems platform
- Enterprise security and compliance features

---

**After Dark Systems** - Leading innovation in AI agent infrastructure and MCP server technology.
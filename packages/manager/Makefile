.PHONY: help install build dev clean typecheck \
        init scan list status verify sync \
        py-install py-dev

# ── Defaults ─────────────────────────────────────────────────────────────────

REGISTRY ?= .agent/mcp-registry.json
DIR      ?= .

help: ## Show this help
	@awk 'BEGIN{FS=":.*##"; printf "\n\033[1mmcp-manager\033[0m — Makefile targets\n\n"} /^[a-zA-Z_.-]+:.*?##/{printf "  \033[36m%-18s\033[0m %s\n",$$1,$$2} /^##/{printf "\n\033[33m%s\033[0m\n",substr($$0,4)}' $(MAKEFILE_LIST)
	@echo ""

## ── Node / TypeScript ────────────────────────────────────────────────────────

install: ## Install Node.js dependencies
	npm install

build: ## Compile TypeScript → dist/
	npm run build

dev: ## Run CLI in dev mode (tsx, no compile needed)
	npm run dev -- $(ARGS)

clean: ## Remove dist/ directory
	npm run clean

typecheck: ## Type-check without emitting
	npm run typecheck

## ── mcp-manager commands ─────────────────────────────────────────────────────

init: ## Bootstrap .agent/ in DIR (make init DIR=/path/to/project)
	npx tsx src/cli.ts init $(DIR) --yes

scan: ## Scan DIR for MCP server suggestions (make scan DIR=/path/to/project)
	npx tsx src/cli.ts scan $(DIR) --registry $(REGISTRY)

list: ## List all servers in registry
	npx tsx src/cli.ts list --registry $(REGISTRY)

list-enabled: ## List only enabled servers
	npx tsx src/cli.ts list --enabled --registry $(REGISTRY)

status: ## Health check all enabled servers
	npx tsx src/cli.ts status --log --registry $(REGISTRY)

verify: ## Verify all enabled servers and write logs
	npx tsx src/cli.ts verify --registry $(REGISTRY)

sync: ## Dry-run sync to Claude Code settings (use sync-apply to write)
	npx tsx src/cli.ts sync --dry-run --registry $(REGISTRY)

sync-apply: ## Push enabled servers to local Claude Code settings.json
	npx tsx src/cli.ts sync --force --registry $(REGISTRY)

sync-global: ## Push enabled servers to global ~/.claude/settings.json
	npx tsx src/cli.ts sync --global --force --registry $(REGISTRY)

templates: ## List all built-in server templates
	npx tsx src/cli.ts templates

logs: ## Show recent logs (make logs SERVER=postgres)
	npx tsx src/cli.ts logs $(SERVER) --lines 80

## ── Python wrapper ────────────────────────────────────────────────────────────

py-install: ## Install Python wrapper in editable mode
	pip install -e py/

py-dev: ## Run Python CLI directly (make py-dev ARGS="list")
	python -m mcp_manager.cli $(ARGS)

## ── Publishing ────────────────────────────────────────────────────────────────

publish-dry: ## Dry-run npm publish
	npm publish --dry-run

publish: ## Publish to npm (requires npm login)
	npm publish --access public

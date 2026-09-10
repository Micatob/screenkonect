.PHONY: help install build dev test lint typecheck clean docker-up docker-down docker-logs db-migrate db-generate status

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm ci

build: ## Build all packages
	npm run build

dev: ## Start all services in development mode
	docker compose -f deploy/docker-compose.yaml up -d postgres redis
	@sleep 3
	npm run db:migrate
	npm run dev

test: ## Run tests
	npm test

lint: ## Run linter
	npm run lint

typecheck: ## Run type checking
	npm run typecheck

clean: ## Clean build artifacts
	rm -rf node_modules packages/*/dist services/*/dist apps/*/dist

docker-up: ## Start all services with Docker
	docker compose -f deploy/docker-compose.yaml up -d --build

docker-down: ## Stop all Docker services
	docker compose -f deploy/docker-compose.yaml down

docker-logs: ## View Docker logs
	docker compose -f deploy/docker-compose.yaml logs -f

db-migrate: ## Run database migrations
	npm run db:migrate -w @screenkonect/db

db-generate: ## Generate database migrations
	npm run db:generate -w @screenkonect/db

db-studio: ## Open Drizzle Studio
	npm run db:studio -w @screenkonect/db

format: ## Format code
	npm run format

setup: install db-migrate ## Initial project setup
	@echo "Setup complete! Run 'make dev' to start development."

status: ## Show running containers and API health
	docker compose -f deploy/docker-compose.yaml ps
	@echo "--- API health ---"
	@for port in 4000 4001 4002 4003 4004; do \
		code=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$$port/healthz || echo "ERR"); \
		echo "auth/session/signaling/audit/device ($$port): $$code"; \
	done
	@for port in 5173 5174; do \
		code=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$$port/ || echo "ERR"); \
		echo "web app ($$port): $$code"; \
	done

agent-build: ## Build the Rust desktop agent (requires Rust toolchain)
	cd apps/desktop-agent && cargo build --release
	cp apps/desktop-agent/target/release/screenkonect-agent.exe deploy/downloads/screenkonect-agent.exe 2>/dev/null || \
	cp apps/desktop-agent/target/release/screenkonect-agent deploy/downloads/screenkonect-agent 2>/dev/null || \
	echo "Build complete but binary not found - check apps/desktop-agent/target/release/"

agent-download: ## Download latest agent release from GitHub
	@echo "Downloading latest agent from GitHub releases..."
	powershell -Command "Invoke-WebRequest -Uri 'https://github.com/anomalyco/screenkonect/releases/latest/download/screenkonect-agent-windows.exe' -OutFile 'deploy/downloads/screenkonect-agent.exe'" 2>/dev/null || \
		echo "Could not download from GitHub. Build locally with 'make agent-build' or place the exe manually in deploy/downloads/"

gateway-recreate: ## Recreate gateway after adding agent binary
	docker compose -f deploy/docker-compose.yaml up -d --force-recreate gateway

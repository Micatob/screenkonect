# Agent downloads (served at /downloads/* by the gateway)

The gateway serves files from this directory. Place the built agent binary here:

    screenkonect-agent.exe

## How to get the agent binary

### Option 1: GitHub Actions (recommended)
1. Push to main or create an `agent-v*` tag
2. Go to GitHub repo -> Actions -> "Agent Release (Windows exe)" run
3. Download `screenkonect-agent-windows` artifact
4. Place it in this directory as `screenkonect-agent.exe`

### Option 2: Build locally (requires Rust)
    make agent-build

### Option 3: Download from latest release
    make agent-download

## After placing the binary

Recreate the gateway to pick up the new file:

    docker compose -f deploy/docker-compose.yaml up -d --force-recreate gateway

Or on VPS:
    git pull && docker compose -f deploy/docker-compose.yaml up -d --force-recreate gateway

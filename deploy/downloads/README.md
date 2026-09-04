# Agent downloads (served at /downloads/* by the gateway)

Drop the built Windows exe here on the VPS as:

  screenkonect-agent.exe

Get it from: GitHub repo -> Actions -> "Agent Release (Windows exe)" run ->
`screenkonect-agent-windows` artifact (or tag `agent-vX.Y.Z` for a permanent Release).

Clients then download straight from `http(s)://<server>:8090/downloads/screenkonect-agent.exe`
with no GitHub account. After `git pull`, recreate the gateway:

  docker compose -f deploy/docker-compose.yaml up -d --force-recreate gateway

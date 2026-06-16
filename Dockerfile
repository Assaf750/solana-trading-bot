# Soltrade production image (ADR-0001 Phase Deploy-1). Builds the operator UI and runs the apps/server
# runtime (which also serves the built UI). Postgres / Redis / ClickHouse are EXTERNAL services wired via
# env (STORAGE_BACKEND / HOT_STATE_BACKEND / EVENT_SINK_BACKEND + URLs) — see docs/runbooks/deploy.md.
# The Rust hot-executor (official signer) is OPTIONAL: build it separately and provide HOT_EXECUTOR_BIN
# (mount the binary or extend this Dockerfile — see deploy.md). NO secrets are baked into the image.

# --- Stage 1: build the operator UI (Vite) ---
FROM node:20-slim AS ui-build
WORKDIR /app/apps/operator-ui
# install from the tracked lockfile first (cache-friendly), then build
COPY apps/operator-ui/package.json apps/operator-ui/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/operator-ui/ ./
RUN npm run build

# --- Stage 2: runtime (apps/server + pure packages + gRPC ingestor + built UI) ---
FROM node:20-slim AS runtime
# SOLTRADE_HOST=0.0.0.0 so Docker port-forwarding reaches the server (it binds loopback by default).
# The anti-DNS-rebinding Host-header guard still requires a localhost Host, so publish the port to
# 127.0.0.1 (e.g. -p 127.0.0.1:8787:8787) or front it with a reverse proxy — see docs/runbooks/deploy.md.
ENV NODE_ENV=production \
    SOLTRADE_HOST=0.0.0.0 \
    SOLTRADE_PORT=8787 \
    SOLTRADE_DATA_DIR=/data
WORKDIR /app

# Root runtime deps are ONLY pg + redis (loaded dynamically in postgres/redis mode; pure-JS, no build
# tools). The repo intentionally tracks no ROOT lockfile, so resolve fresh; --workspaces=false installs
# only the root deps (the pure packages are copied below and imported by relative path, not linked).
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund --workspaces=false

# Server code + the pure domain packages + the gRPC ingestor (the only services/ dir the server imports).
COPY apps/server ./apps/server
COPY packages ./packages
COPY services/ingestor ./services/ingestor
# The server serves the UI from REPO_ROOT/apps/operator-ui/dist (see apps/server/src/server.mjs).
COPY --from=ui-build /app/apps/operator-ui/dist ./apps/operator-ui/dist

# Default JSON store lives here; mount a volume to persist it across restarts.
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8787

# Health probe (Phase Deploy-2): the runtime-readiness endpoint must answer 200. Uses node's global fetch
# (curl/wget are absent in slim); Host 127.0.0.1 satisfies the anti-DNS-rebinding guard. Read-only check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.SOLTRADE_PORT||8787)+'/api/runtime/readiness').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Safe defaults (json / memory / none). Attach external Postgres/Redis/ClickHouse by setting the
# *_BACKEND flags + their URLs. Open-by-design: the server starts and idles honestly until configured.
CMD ["node", "apps/server/src/index.mjs"]

# syntax=docker/dockerfile:1.7

# ---------- Builder ----------
FROM node:22-bookworm-slim AS builder

# Build deps for better-sqlite3 (fallback if prebuilt binary missing for arch)
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server
COPY scripts ./scripts

ARG BASE_PATH=/
ENV BASE_PATH=$BASE_PATH
RUN npm run build
RUN npm prune --omit=dev

# ---------- Runtime ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data

WORKDIR /app

# Non-root user
RUN groupadd -r app && useradd -r -g app -d /app -s /usr/sbin/nologin app \
 && mkdir -p /data && chown -R app:app /data /app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/server ./server
COPY --from=builder --chown=app:app /app/scripts ./scripts
COPY --from=builder --chown=app:app /app/package.json ./package.json

USER app

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]

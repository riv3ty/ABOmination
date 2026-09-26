# syntax=docker/dockerfile:1
# ABOmination: Web-App bauen, dann schlankes Laufzeit-Image mit Server + gebauter App

# --- 1) Web-App bauen (dist/index.html) ---
FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY vite.config.js ./
COPY web ./web
RUN npm run build

# --- 2) nur Laufzeit-Abhängigkeiten ---
FROM node:26-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# --- 3) Laufzeit ---
FROM node:26-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    DATA_DIR=/data \
    STATIC_DIR=/app/dist
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server/src ./server/src
COPY server/bin ./server/bin
COPY --from=build /app/dist ./dist
# Verwaltungsbefehl "abo" im PATH; Datenverzeichnis gehört dem unprivilegierten Benutzer "node".
# npm/corepack/yarn werden zur Laufzeit nicht gebraucht: entfernen = weniger Angriffsfläche
# (das Image wird dadurch nicht kleiner, die Basis-Schicht bleibt gleich).
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-* \
 && chmod +x server/bin/abo.js \
 && ln -s /app/server/bin/abo.js /usr/local/bin/abo \
 && mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "server/src/index.js"]

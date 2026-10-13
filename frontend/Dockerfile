# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — build the SPA
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — serve static assets + reverse-proxy the API (Nginx)
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf proxy_params.inc /etc/nginx/conf.d/
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/imigrasi/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

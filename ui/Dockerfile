FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.28-alpine

ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER="^(PORT|API_UPSTREAM)$"
ENV API_UPSTREAM=http://api:3000
ENV API_PUBLIC_URL=/api

COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

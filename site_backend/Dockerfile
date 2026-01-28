FROM node:20-alpine AS build

WORKDIR /app

# Install build deps
RUN apk add --no-cache python3 make g++

# Copy package metadata and install deps
COPY package.json tsconfig.json ./
RUN npm install

# Copy source
COPY src ./src

# Build TypeScript
RUN npm run build

# Runtime image
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

# App listens on 3000
EXPOSE 3000

CMD ["node", "dist/server.js"]

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /exports && chown node:node /exports
ENV NODE_ENV=production
USER node
CMD ["node","apps/api/src/main.mjs"]

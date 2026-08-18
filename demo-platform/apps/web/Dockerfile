FROM node:22.18.0-bookworm-slim AS build

WORKDIR /workspace
COPY package.json package-lock.json tsconfig.base.json eslint.config.js ./
COPY packages/contracts/package.json packages/contracts/tsconfig.json ./packages/contracts/
COPY packages/scenario-data/package.json packages/scenario-data/tsconfig.json ./packages/scenario-data/
COPY apps/bff/package.json ./apps/bff/
COPY packages/contracts/src ./packages/contracts/src
COPY packages/scenario-data/src ./packages/scenario-data/src
COPY apps/web/package.json apps/web/tsconfig.json apps/web/tsconfig.server.json apps/web/vite.config.ts apps/web/index.html ./apps/web/
COPY apps/web/public ./apps/web/public
COPY apps/web/src ./apps/web/src
COPY apps/web/server ./apps/web/server
RUN npm ci
RUN npm run build --workspace @stratton/contracts
RUN npm run build --workspace @stratton/scenario-data
RUN npm run build --workspace @stratton/demo-web
RUN npm prune --omit=dev

FROM node:22.18.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace /workspace
USER node
EXPOSE 8080
CMD ["npm", "run", "start", "--workspace", "@stratton/demo-web"]

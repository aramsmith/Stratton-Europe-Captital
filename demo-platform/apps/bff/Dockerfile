FROM node:22.18.0-bookworm-slim AS build

WORKDIR /workspace
COPY package.json package-lock.json tsconfig.base.json eslint.config.js ./
COPY packages/contracts/package.json packages/contracts/tsconfig.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
COPY packages/scenario-data/package.json packages/scenario-data/tsconfig.json ./packages/scenario-data/
COPY packages/scenario-data/src ./packages/scenario-data/src
COPY apps/bff/package.json apps/bff/tsconfig.json ./apps/bff/
COPY apps/web/package.json ./apps/web/
COPY apps/bff/src ./apps/bff/src
RUN npm ci
RUN npm run build --workspace @stratton/contracts
RUN npm run build --workspace @stratton/scenario-data
RUN npm run build --workspace @stratton/demo-bff
RUN npm prune --omit=dev

FROM node:22.18.0-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build --chown=node:node /workspace /workspace
USER node
EXPOSE 3001
CMD ["node", "apps/bff/dist/server.js"]

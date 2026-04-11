# Multi-stage Backstage Docker build
# Stage 1: build
FROM node:20-bookworm-slim AS build

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    python3 g++ build-essential git

ENV YARN_VERSION=4.1.1
RUN corepack enable && corepack prepare yarn@${YARN_VERSION}

WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY packages/app/package.json ./packages/app/
COPY packages/backend/package.json ./packages/backend/

RUN --mount=type=cache,target=/root/.yarn \
    yarn install

COPY . .

RUN yarn tsc
RUN yarn build

# Stage 2: runtime
FROM node:20-bookworm-slim

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

ENV YARN_VERSION=4.1.1
RUN corepack enable && corepack prepare yarn@${YARN_VERSION}

WORKDIR /app

COPY --from=build /app/yarn.lock              ./yarn.lock
COPY --from=build /app/package.json           ./package.json
COPY --from=build /app/.yarnrc.yml            ./.yarnrc.yml
COPY --from=build /app/packages/backend/dist  ./packages/backend/dist
COPY --from=build /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=build /app/packages/app/dist      ./packages/app/dist

RUN --mount=type=cache,target=/root/.yarn \
    yarn workspaces focus --production backend

CMD ["node", "packages/backend/dist/index.cjs"]

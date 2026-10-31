FROM node:20-slim AS builder

WORKDIR /app
RUN npm install -g pnpm@8.15.4

COPY pnpm-lock.yaml* pnpm-workspace.yaml package.json ./
COPY packages/shared ./packages/shared
COPY apps/runner ./apps/runner

RUN pnpm install --filter @proctor-forge/runner... --frozen-lockfile=false
RUN pnpm --filter @proctor-forge/shared build
RUN pnpm --filter @proctor-forge/runner build

FROM node:20-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/runner/package.json ./apps/runner/
COPY --from=builder /app/apps/runner/dist ./apps/runner/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/apps/runner/node_modules ./apps/runner/node_modules

EXPOSE 5050

CMD ["node", "apps/runner/dist/index.js"]


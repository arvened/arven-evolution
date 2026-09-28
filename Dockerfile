# The service has no runtime dependencies: Node.js runs the TypeScript sources directly
# (built-in type stripping, Node >= 22.18), so there is no install or build step.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY src ./src
COPY examples ./examples

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "src/server/index.ts"]

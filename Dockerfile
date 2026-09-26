# Imagem do app (frontend + backend no mesmo servidor)
FROM oven/bun:1 AS build
WORKDIR /app

# Dependências
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Código e build de produção (servidor Node para rodar no VPS)
COPY . .
ENV NITRO_PRESET=node-server
RUN bun run build

# Imagem final enxuta
FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["bun", ".output/server/index.mjs"]

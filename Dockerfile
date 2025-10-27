# Use Bun image
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Install dependencies only
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

# Copy dependencies and source files
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./package.json
COPY tsconfig.json ./tsconfig.json
COPY bunfig.toml ./bunfig.toml

# Create storage directories
RUN mkdir -p storage/uploads storage/videos assets/music assets/fonts assets/images

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Start both API and Worker using concurrently
CMD ["bun", "run", "start"]

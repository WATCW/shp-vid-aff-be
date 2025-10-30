# Use Bun image
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# Install system dependencies (ffmpeg for video generation)
RUN apk add --no-cache ffmpeg

# Install dependencies only
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Production image
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

# Install only runtime dependencies
RUN apk add --no-cache ffmpeg

ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Copy only production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files
COPY src ./src
COPY package.json ./package.json
COPY tsconfig.json ./tsconfig.json

# Create storage directories with proper permissions
RUN mkdir -p storage/uploads storage/videos assets/music assets/fonts assets/images && \
    chown -R bun:bun storage assets

# Use non-root user
USER bun

# Expose port (default 8000)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://localhost:' + (process.env.PORT || '8000') + '/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Start both API and Worker using concurrently
CMD ["bun", "run", "start"]

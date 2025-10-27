import { z } from 'zod'

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Database
  MONGODB_URI: z.string().default('mongodb://localhost:27017/shopee-video-gen'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),

  // AI API Keys
  AI_PROVIDER: z.enum(['openai', 'anthropic']).default('openai'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20241022'),

  // Google Drive (Optional)
  GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_REDIRECT_URI: z.string().optional(),
  GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),

  // Storage
  STORAGE_PATH: z.string().default('./storage/videos'),
  UPLOAD_PATH: z.string().default('./storage/uploads'),
  MAX_FILE_SIZE: z.string().default('104857600'), // 100MB

  // Video Generation
  DEFAULT_VIDEO_DURATION: z.string().default('15'),
  DEFAULT_VIDEO_RESOLUTION: z.string().default('1080x1920'),
  DEFAULT_VIDEO_FPS: z.string().default('30'),
  DEFAULT_VIDEO_CODEC: z.string().default('libx264'),
  DEFAULT_AUDIO_CODEC: z.string().default('aac'),
  MAX_VIDEO_SIZE: z.string().default('52428800'), // 50MB

  // Queue
  QUEUE_CONCURRENCY: z.string().default('3'),
  QUEUE_MAX_ATTEMPTS: z.string().default('3'),
  QUEUE_BACKOFF_DELAY: z.string().default('5000'),

  // Scraping
  SCRAPER_TIMEOUT: z.string().default('30000'),
  SCRAPER_HEADLESS: z.string().default('true'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().default('100'),
  RATE_LIMIT_WINDOW: z.string().default('60000'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Feature Flags
  ENABLE_GOOGLE_DRIVE: z.string().default('false'),
  ENABLE_AUTO_SCRAPING: z.string().default('true'),
  ENABLE_BATCH_PROCESSING: z.string().default('true'),
})

type Env = z.infer<typeof envSchema>

// Parse and validate environment variables
const parseEnv = (): Env => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:')
    if (error instanceof z.ZodError) {
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`)
      })
    }
    process.exit(1)
  }
}

export const env = parseEnv()

// Helper functions to get typed config values
export const config = {
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: parseInt(env.PORT),
    host: env.HOST,
    frontendUrl: env.FRONTEND_URL,
    corsOrigin: env.CORS_ORIGIN,
  },

  database: {
    mongoUri: env.MONGODB_URI,
    redisUrl: env.REDIS_URL,
    rabbitmqUrl: env.RABBITMQ_URL,
  },

  ai: {
    provider: env.AI_PROVIDER,
    openai: {
      apiKey: env.OPENAI_API_KEY || '',
      model: env.OPENAI_MODEL,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY || '',
      model: env.ANTHROPIC_MODEL,
    },
  },

  googleDrive: {
    clientId: env.GOOGLE_DRIVE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_DRIVE_CLIENT_SECRET || '',
    redirectUri: env.GOOGLE_DRIVE_REDIRECT_URI || '',
    refreshToken: env.GOOGLE_DRIVE_REFRESH_TOKEN || '',
    folderId: env.GOOGLE_DRIVE_FOLDER_ID || '',
  },

  storage: {
    path: env.STORAGE_PATH,
    uploadPath: env.UPLOAD_PATH,
    maxFileSize: parseInt(env.MAX_FILE_SIZE),
  },

  video: {
    duration: parseInt(env.DEFAULT_VIDEO_DURATION),
    resolution: env.DEFAULT_VIDEO_RESOLUTION,
    fps: parseInt(env.DEFAULT_VIDEO_FPS),
    codec: env.DEFAULT_VIDEO_CODEC,
    audioCodec: env.DEFAULT_AUDIO_CODEC,
    maxSize: parseInt(env.MAX_VIDEO_SIZE),
  },

  queue: {
    concurrency: parseInt(env.QUEUE_CONCURRENCY),
    maxAttempts: parseInt(env.QUEUE_MAX_ATTEMPTS),
    backoffDelay: parseInt(env.QUEUE_BACKOFF_DELAY),
  },

  scraper: {
    timeout: parseInt(env.SCRAPER_TIMEOUT),
    headless: env.SCRAPER_HEADLESS === 'true',
  },

  rateLimit: {
    max: parseInt(env.RATE_LIMIT_MAX),
    window: parseInt(env.RATE_LIMIT_WINDOW),
  },

  logging: {
    level: env.LOG_LEVEL,
  },

  features: {
    googleDrive: env.ENABLE_GOOGLE_DRIVE === 'true',
    autoScraping: env.ENABLE_AUTO_SCRAPING === 'true',
    batchProcessing: env.ENABLE_BATCH_PROCESSING === 'true',
  },
}

export default config

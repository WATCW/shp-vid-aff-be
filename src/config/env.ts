import { z } from 'zod'

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('*'),

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

  // Storage
  STORAGE_PATH: z.string().default('./storage/videos'),
  UPLOAD_PATH: z.string().default('./storage/uploads'),
  MAX_FILE_SIZE: z.string().default('104857600'), // 100MB

  // Queue
  QUEUE_CONCURRENCY: z.string().default('3'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
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

  storage: {
    path: env.STORAGE_PATH,
    uploadPath: env.UPLOAD_PATH,
    maxFileSize: parseInt(env.MAX_FILE_SIZE),
  },

  queue: {
    concurrency: parseInt(env.QUEUE_CONCURRENCY),
  },

  logging: {
    level: env.LOG_LEVEL,
  },
}

export default config

import Redis from 'ioredis'
import config from './env'
import logger from '@utils/logger'

let redis: Redis | null = null
let redisAvailable = false

try {
  redis = new Redis(config.database.redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        logger.warn('⚠️  Redis connection failed after 3 attempts. Running without Redis (Queue features disabled)')
        return null // Stop retrying
      }
      const delay = Math.min(times * 50, 2000)
      return delay
    },
    lazyConnect: true, // Don't connect immediately
    enableReadyCheck: false,
    connectTimeout: 5000, // 5 second timeout
  })

  redis.on('connect', () => {
    logger.info('✅ Redis connected successfully')
    redisAvailable = true
  })

  redis.on('error', (error) => {
    logger.error('❌ Redis connection error:', error.message)
    redisAvailable = false
  })

  redis.on('ready', () => {
    logger.info('Redis is ready')
    redisAvailable = true
  })

  redis.on('close', () => {
    logger.warn('⚠️  Redis connection closed')
    redisAvailable = false
  })

  // Try to connect
  redis.connect().catch((error) => {
    logger.warn('⚠️  Redis is not available:', error.message)
    logger.warn('⚠️  Queue features (AI generation, video generation) will be disabled')
    redisAvailable = false
  })

  // Graceful shutdown
  process.on('SIGINT', async () => {
    if (redis && redisAvailable) {
      await redis.quit()
      logger.info('Redis connection closed through app termination')
    }
  })

} catch (error) {
  logger.warn('⚠️  Failed to initialize Redis:', error instanceof Error ? error.message : 'Unknown error')
  logger.warn('⚠️  Running without Redis. Queue features will be disabled.')
  redis = null
  redisAvailable = false
}

export { redis, redisAvailable }
export default redis

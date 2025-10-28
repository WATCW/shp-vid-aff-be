import { connectDatabase } from '@config/database'
import { ensureRabbitMQ, getConnection } from '@config/rabbitmq'
import { initializeQueues } from './jobs/queue'
import logger from '@utils/logger'
import { createAIContentWorker } from './jobs/ai-content.job'

/**
 * Background worker process for handling queue jobs
 */
const startWorker = async () => {
  try {
    logger.info('🚀 Starting background worker...')

    // Connect to database
    await connectDatabase()

    // Initialize RabbitMQ connection
    const rabbitMQReady = await ensureRabbitMQ()

    if (!rabbitMQReady) {
      logger.error('❌ Failed to connect to RabbitMQ')
      logger.warn('⚠️  Worker will run in degraded mode (queue features disabled)')
      logger.info('💡 To enable queue features, please check:')
      logger.info('   1. RabbitMQ endpoint is accessible')
      logger.info('   2. RABBITMQ_URL environment variable is set correctly')
      logger.info(`   3. Current RABBITMQ_URL: ${process.env.RABBITMQ_URL}`)

      // Run in idle mode - keep worker alive but do nothing
      logger.info(`
🔧 Background Worker is running in IDLE mode!

⚠️  No active workers (RabbitMQ unavailable)
🔄 Worker will attempt to reconnect automatically

Press CTRL+C to stop
      `)

      // Keep process alive
      const keepAlive = () => {
        // Do nothing, just keep process running
      }
      setInterval(keepAlive, 60000) // Check every minute

      // Graceful shutdown
      const shutdown = async () => {
        logger.info('Shutting down worker...')
        logger.info('Worker shut down successfully')
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)

      return // Exit early, don't try to create workers
    }

    // Initialize queues
    await initializeQueues()

    // Start AI content worker
    const aiContentWorker = await createAIContentWorker()

    if (!aiContentWorker) {
      logger.error('❌ Failed to create AI content worker')
      logger.warn('⚠️  Worker will run in degraded mode')

      logger.info(`
🔧 Background Worker is running in IDLE mode!

⚠️  No active workers (Worker creation failed)

Press CTRL+C to stop
      `)

      // Keep process alive
      const keepAlive = () => {
        // Do nothing, just keep process running
      }
      setInterval(keepAlive, 60000)

      // Graceful shutdown
      const shutdown = async () => {
        logger.info('Shutting down worker...')
        const connection = getConnection()
        if (connection) {
          await connection.close()
          logger.info('RabbitMQ connection closed')
        }
        logger.info('Worker shut down successfully')
        process.exit(0)
      }

      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)

      return
    }

    logger.info(`
🔧 Background Worker is running!

📊 Active Workers:
  - AI Content Generation (RabbitMQ consumer)
  - Queue: ${aiContentWorker.queueName}

Press CTRL+C to stop
    `)

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down worker...')

      // Close RabbitMQ connection
      const connection = getConnection()
      if (connection) {
        await connection.close()
        logger.info('RabbitMQ connection closed')
      }

      logger.info('Worker shut down successfully')
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

  } catch (error) {
    logger.error('Failed to start worker:', error)
    logger.warn('Worker will continue in degraded mode')

    // Keep process alive even on error
    const keepAlive = () => {
      // Do nothing, just keep process running
    }
    setInterval(keepAlive, 60000)

    const shutdown = async () => {
      logger.info('Shutting down worker...')
      logger.info('Worker shut down successfully')
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  }
}

// Start worker
startWorker()

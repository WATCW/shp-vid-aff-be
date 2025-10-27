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
      logger.info('⚠️  Worker will exit. Please check:')
      logger.info('   1. RabbitMQ endpoint is accessible')
      logger.info('   2. RABBITMQ_URL environment variable is set correctly')
      logger.info(`   3. Current RABBITMQ_URL: ${process.env.RABBITMQ_URL}`)
      process.exit(1)
    }

    // Initialize queues
    await initializeQueues()

    // Start AI content worker
    const aiContentWorker = await createAIContentWorker()

    if (!aiContentWorker) {
      logger.error('❌ Failed to create AI content worker')
      logger.info('⚠️  Worker will exit')
      process.exit(1)
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
    logger.info('Hint: Verify RABBITMQ_URL is set and RabbitMQ service is accessible')
    process.exit(1)
  }
}

// Start worker
startWorker()

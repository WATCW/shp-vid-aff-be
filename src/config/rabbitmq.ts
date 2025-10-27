import amqp, { Connection, Channel } from 'amqplib'
import config from './env'
import logger from '@utils/logger'

let connection: Connection | null = null
let channel: Channel | null = null
let rabbitmqAvailable = false

// Queue names
export const QUEUE_NAMES = {
  AI_CONTENT: 'vid-processor-mq',
  SCRAPER: 'vid-processor-mq-scraper',
  VIDEO: 'vid-processor-mq-video',
}

// Initialize RabbitMQ connection
const initializeRabbitMQ = async () => {
  try {
    logger.info('🐰 Connecting to RabbitMQ...')
    logger.info(`📍 RabbitMQ URL: ${config.database.rabbitmqUrl}`)

    // Create connection
    connection = await amqp.connect(config.database.rabbitmqUrl)

    logger.info('✅ RabbitMQ connected successfully')

    // Create channel
    channel = await connection.createChannel()

    logger.info('✅ RabbitMQ channel created')

    // Assert queues (create if they don't exist)
    await Promise.all(
      Object.values(QUEUE_NAMES).map(async (queueName) => {
        await channel!.assertQueue(queueName, {
          durable: true, // Queue will survive RabbitMQ restarts
        })
        logger.info(`✅ Queue asserted: ${queueName}`)
      })
    )

    rabbitmqAvailable = true

    // Handle connection errors
    connection.on('error', (error) => {
      logger.error('❌ RabbitMQ connection error:', error.message)
      rabbitmqAvailable = false
    })

    connection.on('close', () => {
      logger.warn('⚠️  RabbitMQ connection closed')
      rabbitmqAvailable = false

      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        logger.info('🔄 Attempting to reconnect to RabbitMQ...')
        initializeRabbitMQ()
      }, 5000)
    })

    // Handle channel errors
    channel.on('error', (error) => {
      logger.error('❌ RabbitMQ channel error:', error.message)
    })

    channel.on('close', () => {
      logger.warn('⚠️  RabbitMQ channel closed')
    })

    return true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''

    logger.error('⚠️  RabbitMQ is not available:', errorMessage)
    if (errorStack) {
      logger.error('Stack trace:', errorStack)
    }
    logger.warn('⚠️  Queue features (AI generation, video generation) will be disabled')

    rabbitmqAvailable = false
    connection = null
    channel = null
    return false
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (channel) {
    await channel.close()
    logger.info('RabbitMQ channel closed through app termination')
  }
  if (connection) {
    await connection.close()
    logger.info('RabbitMQ connection closed through app termination')
  }
})

// Initialize on import (lazy)
const initPromise = initializeRabbitMQ()

// Helper to ensure connection is ready
export const ensureRabbitMQ = async (): Promise<boolean> => {
  await initPromise
  return rabbitmqAvailable
}

// Get channel (null if not available)
export const getChannel = (): Channel | null => {
  if (!rabbitmqAvailable || !channel) {
    logger.warn('⚠️  RabbitMQ channel not available')
    return null
  }
  return channel
}

// Get connection (null if not available)
export const getConnection = (): Connection | null => {
  if (!rabbitmqAvailable || !connection) {
    logger.warn('⚠️  RabbitMQ connection not available')
    return null
  }
  return connection
}

export { rabbitmqAvailable }
export default { connection, channel, rabbitmqAvailable, ensureRabbitMQ, getChannel, getConnection }

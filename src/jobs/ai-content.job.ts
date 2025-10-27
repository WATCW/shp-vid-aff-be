import { Channel, ConsumeMessage } from 'amqplib'
import { getChannel, rabbitmqAvailable } from '@config/rabbitmq'
import { QUEUE_NAMES, AIContentJobData } from './queue'
import aiContentService from '@services/ai-content.service'
import { Product } from '@models/product.model'
import { Job } from '@models/job.model'
import logger from '@utils/logger'
import config from '@config/env'

/**
 * Process AI content generation job from RabbitMQ message
 */
const processAIContentJob = async (messageData: AIContentJobData & { jobId: string; timestamp: string }) => {
  const { productId, options, jobId } = messageData

  logger.info(`[AI-WORKER] Processing job ${jobId} for product: ${productId}`)

  try {
    // Update job status
    await Job.findOneAndUpdate(
      { productId, type: 'ai_content', status: { $ne: 'completed' } },
      {
        $set: { status: 'active', startedAt: new Date() },
        $inc: { attempts: 1 },
      }
    )

    // Update product status
    await Product.findOneAndUpdate(
      { productId },
      { $set: { status: 'ai_processing' } }
    )

    // Get product
    const product = await Product.findOne({ productId })

    if (!product) {
      throw new Error(`Product not found: ${productId}`)
    }

    // Update progress in DB
    await Job.findOneAndUpdate(
      { productId, type: 'ai_content', status: 'active' },
      { $set: { progress: 20 } }
    )

    // Generate AI content
    logger.info(`[AI-WORKER] Generating AI content for product: ${productId}`)
    const aiContent = await aiContentService.generateContent(product, options)

    // Update progress
    await Job.findOneAndUpdate(
      { productId, type: 'ai_content', status: 'active' },
      { $set: { progress: 80 } }
    )

    // Save to product
    product.aiContent = aiContent
    product.status = 'ready'
    await product.save()

    // Update job record
    await Job.findOneAndUpdate(
      { productId, type: 'ai_content', status: 'active' },
      {
        $set: {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          result: aiContent,
        },
      }
    )

    logger.info(`[AI-WORKER] ✅ AI content generated successfully for product: ${productId}`)

    return {
      success: true,
      productId,
      aiContent,
    }

  } catch (error) {
    logger.error(`[AI-WORKER] ❌ AI content job failed for product ${productId}:`, error)

    // Update product status
    await Product.findOneAndUpdate(
      { productId },
      { $set: { status: 'failed' } }
    )

    // Update job record
    await Job.findOneAndUpdate(
      { productId, type: 'ai_content', status: 'active' },
      {
        $set: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }
    )

    throw error
  }
}

/**
 * Create RabbitMQ consumer for AI content generation
 */
export const createAIContentWorker = async () => {
  const channel = getChannel()

  if (!channel || !rabbitmqAvailable) {
    logger.warn('⚠️  Cannot create AI content worker - RabbitMQ is not available')
    return null
  }

  try {
    // Set prefetch count (concurrency control)
    await channel.prefetch(config.queue.concurrency)

    logger.info(`[AI-WORKER] Starting AI content consumer on queue: ${QUEUE_NAMES.AI_CONTENT}`)

    // Start consuming messages
    await channel.consume(
      QUEUE_NAMES.AI_CONTENT,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return
        }

        try {
          // Parse message
          const messageData = JSON.parse(msg.content.toString())

          logger.info(`[AI-WORKER] 📥 Received job: ${messageData.jobId}`)

          // Process the job
          await processAIContentJob(messageData)

          // Acknowledge the message (job completed successfully)
          channel.ack(msg)
          logger.info(`[AI-WORKER] ✅ Job ${messageData.jobId} acknowledged`)

        } catch (error) {
          logger.error(`[AI-WORKER] ❌ Failed to process message:`, error)

          // Reject and requeue the message (for retry)
          // You can set requeue to false if you don't want to retry
          const shouldRequeue = false // Don't requeue on failure
          channel.nack(msg, false, shouldRequeue)

          if (shouldRequeue) {
            logger.info(`[AI-WORKER] Message requeued for retry`)
          } else {
            logger.info(`[AI-WORKER] Message rejected (not requeued)`)
          }
        }
      },
      {
        noAck: false, // Manual acknowledgment
      }
    )

    logger.info('✅ AI content worker started successfully')

    return { channel, queueName: QUEUE_NAMES.AI_CONTENT }
  } catch (error) {
    logger.error('❌ Failed to create AI content worker:', error)
    return null
  }
}

export default createAIContentWorker

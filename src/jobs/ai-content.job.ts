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
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    logger.error(`[AI-WORKER] ❌ AI content job failed for product ${productId}:`)
    logger.error(`Error: ${errorMessage}`)
    if (errorStack) {
      logger.error(`Stack: ${errorStack}`)
    }

    // Update product status
    try {
      await Product.findOneAndUpdate(
        { productId },
        { $set: { status: 'failed' } }
      )
    } catch (updateError) {
      logger.error('[AI-WORKER] Failed to update product status:', updateError)
    }

    // Update job record
    try {
      await Job.findOneAndUpdate(
        { productId, type: 'ai_content', status: 'active' },
        {
          $set: {
            status: 'failed',
            error: errorMessage,
            completedAt: new Date(),
          },
        }
      )
    } catch (updateError) {
      logger.error('[AI-WORKER] Failed to update job status:', updateError)
    }

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

        let messageData: any

        // Try to parse message first - handle JSON parse errors
        try {
          messageData = JSON.parse(msg.content.toString())
        } catch (parseError) {
          logger.error('[AI-WORKER] ❌ Invalid message format - not valid JSON')
          logger.error('Message content:', msg.content.toString())
          logger.error('Parse error:', parseError)

          // Reject invalid messages without requeue
          channel.nack(msg, false, false)
          return
        }

        try {
          const retryCount = msg.properties.headers?.['x-retry-count'] || 0

          logger.info(`[AI-WORKER] 📥 Received job: ${messageData.jobId} (attempt ${retryCount + 1})`)

          // Process the job
          await processAIContentJob(messageData)

          // Acknowledge the message (job completed successfully)
          channel.ack(msg)
          logger.info(`[AI-WORKER] ✅ Job ${messageData.jobId} completed successfully`)

        } catch (error) {
          const retryCount = msg.properties.headers?.['x-retry-count'] || 0
          const maxRetries = 3

          const errorMessage = error instanceof Error ? error.message : String(error)
          logger.error(`[AI-WORKER] ❌ Failed to process job ${messageData.jobId}: ${errorMessage}`, error)

          if (retryCount >= maxRetries) {
            // Max retries reached - mark as failed permanently
            logger.error(`[AI-WORKER] Max retries (${maxRetries}) reached for job ${messageData.jobId}, marking as failed`)

            // Update job in database as failed
            try {
              await Job.findOneAndUpdate(
                { productId: messageData.productId, type: 'ai_content' },
                {
                  $set: {
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    completedAt: new Date(),
                  },
                }
              )
            } catch (updateError) {
              logger.error('[AI-WORKER] Failed to update job status:', updateError)
            }

            // Don't requeue - message will be discarded
            channel.nack(msg, false, false)
            logger.info(`[AI-WORKER] Job ${messageData.jobId} permanently failed after ${maxRetries} attempts`)
          } else {
            // Retry - republish with updated retry count
            logger.warn(`[AI-WORKER] Retry ${retryCount + 1}/${maxRetries} for job ${messageData.jobId}`)

            try {
              // Publish new message with incremented retry count
              const newHeaders = {
                ...(msg.properties.headers || {}),
                'x-retry-count': retryCount + 1,
              }

              channel.sendToQueue(
                QUEUE_NAMES.AI_CONTENT,
                Buffer.from(msg.content.toString()),
                {
                  ...msg.properties,
                  headers: newHeaders,
                }
              )

              logger.info(`[AI-WORKER] Requeued job ${messageData.jobId} with retry count ${retryCount + 1}`)

              // Acknowledge original message (we've republished it)
              channel.ack(msg)
            } catch (requeueError) {
              logger.error('[AI-WORKER] Failed to requeue message:', requeueError)
              // If requeue fails, nack without requeue to avoid infinite loop
              channel.nack(msg, false, false)
            }
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

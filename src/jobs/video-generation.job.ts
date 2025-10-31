import { Channel, ConsumeMessage } from 'amqplib'
import { getChannel, rabbitmqAvailable } from '@config/rabbitmq'
import { QUEUE_NAMES, VideoJobData } from './queue'
import videoGeneratorService from '@services/video-generator.service'
import Video from '@models/video.model'
import { Product } from '@models/product.model'
import { Job } from '@models/job.model'
import logger from '@utils/logger'

/**
 * Process video generation job from RabbitMQ message
 */
const processVideoGenerationJob = async (messageData: VideoJobData & { jobId: string; timestamp: string }) => {
  const { productId, templateId, customConfig, jobId } = messageData

  logger.info(`[VIDEO-WORKER] 🎬 Processing job ${jobId} for product: ${productId}`)
  logger.info(`[VIDEO-WORKER] 📦 Job data:`, { productId, templateId, customConfig })

  try {
    // Get product first (productId is Shopify ID string, not MongoDB ObjectId)
    logger.info(`[VIDEO-WORKER] 🔍 Searching for product with productId: ${productId}`)
    const product = await Product.findOne({ productId })

    if (!product) {
      logger.error(`[VIDEO-WORKER] ❌ Product not found: ${productId}`)
      throw new Error(`Product not found: ${productId}`)
    }

    logger.info(`[VIDEO-WORKER] ✅ Product found:`, {
      _id: product._id,
      name: product.name,
      hasAIContent: !!product.aiContent,
      imagesCount: product.images?.length || 0
    })

    if (!product.aiContent) {
      logger.error(`[VIDEO-WORKER] ❌ Product ${productId} does not have AI content`)
      throw new Error(`Product ${productId} does not have AI content`)
    }

    // Update job status using MongoDB ObjectId
    logger.info(`[VIDEO-WORKER] 💾 Updating job status to active...`)
    await Job.findOneAndUpdate(
      { productId: product._id, type: 'generate_video', status: { $ne: 'completed' } },
      {
        $set: { status: 'active', startedAt: new Date() },
        $inc: { attempts: 1 },
      }
    )

    // Update progress
    const updateProgress = async (progress: number) => {
      await Job.findOneAndUpdate(
        { productId: product._id, type: 'generate_video', status: 'active' },
        { $set: { progress } }
      )
      logger.info(`[VIDEO-WORKER] 📊 Progress updated: ${progress}%`)
    }

    // Generate video with progress callback
    logger.info(`[VIDEO-WORKER] 🎨 Starting video generation for product: ${productId}`)
    logger.info(`[VIDEO-WORKER] 📝 Video config:`, {
      productMongoId: product._id.toString(),
      templateId,
      musicId: customConfig?.musicId,
      customTextLength: customConfig?.customText?.length
    })

    const video = await videoGeneratorService.generateVideo(
      {
        productId: product._id.toString(),
        templateId,
        musicId: customConfig?.musicId,
        customText: customConfig?.customText,
      },
      updateProgress
    )

    logger.info(`[VIDEO-WORKER] ✅ Video file generated successfully!`)

    // Update job record using MongoDB ObjectId
    logger.info(`[VIDEO-WORKER] 💾 Updating job status to completed...`)
    await Job.findOneAndUpdate(
      { productId: product._id, type: 'generate_video', status: 'active' },
      {
        $set: {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
          result: {
            videoId: video._id,
            filePath: video.output?.filePath,
            thumbnailPath: video.output?.thumbnailPath,
            renderTime: video.renderTime,
          },
        },
      }
    )

    logger.info(`[VIDEO-WORKER] 🎉 Job ${jobId} completed successfully! Video ID: ${video._id}`)

    return {
      success: true,
      videoId: video._id,
      productId,
      output: video.output,
    }
  } catch (error: any) {
    logger.error(`[VIDEO-WORKER] ❌ Error generating video for product ${productId}:`, error)
    logger.error(`[VIDEO-WORKER] 📚 Error stack:`, error.stack)

    // Try to get product for MongoDB ObjectId
    try {
      const product = await Product.findOne({ productId })
      if (product) {
        // Update job as failed using MongoDB ObjectId
        await Job.findOneAndUpdate(
          { productId: product._id, type: 'generate_video' },
          {
            $set: {
              status: 'failed',
              error: error.message || 'Video generation failed',
              completedAt: new Date(),
            },
          }
        )
      }
    } catch (updateError) {
      logger.error('[VIDEO-WORKER] Failed to update job status:', updateError)
    }

    // Note: Video document may not exist yet if error occurred before video service created it
    // The video service handles its own error states internally

    throw error
  }
}

/**
 * Start video generation worker
 */
export const startVideoWorker = async () => {
  if (!rabbitmqAvailable) {
    logger.warn('⚠️  RabbitMQ not available - Video worker disabled')
    return
  }

  const channel = getChannel()

  if (!channel) {
    logger.error('❌ Cannot start video worker - No RabbitMQ channel')
    return
  }

  try {
    // Set prefetch to 1 (process one job at a time per worker)
    await channel.prefetch(1)

    logger.info(`✅ Video generation worker started - Listening on queue: ${QUEUE_NAMES.VIDEO}`)

    // Start consuming messages
    await channel.consume(
      QUEUE_NAMES.VIDEO,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return

        let messageData: any

        // Try to parse message first - handle JSON parse errors
        try {
          const rawContent = msg.content.toString()
          logger.info('[VIDEO-WORKER] 📨 Received message, parsing...')
          logger.info('[VIDEO-WORKER] 📝 Raw content:', rawContent)

          messageData = JSON.parse(rawContent)
          logger.info('[VIDEO-WORKER] ✅ Message parsed successfully:', messageData)
        } catch (parseError) {
          logger.error('[VIDEO-WORKER] ❌ Invalid message format - not valid JSON')
          logger.error('[VIDEO-WORKER] 📄 Message content:', msg.content.toString())
          logger.error('[VIDEO-WORKER] 🔴 Parse error:', parseError)

          // Reject invalid messages without requeue
          channel.nack(msg, false, false)
          return
        }

        try {
          const retryCount = msg.properties.headers?.['x-retry-count'] || 0

          logger.info(`[VIDEO-WORKER] 🔄 Processing job ${messageData.jobId} (attempt ${retryCount + 1})`)

          await processVideoGenerationJob(messageData)

          // Acknowledge message on success
          channel.ack(msg)
          logger.info(`[VIDEO-WORKER] ✅ Job ${messageData.jobId} completed successfully`)
        } catch (error) {
          const retryCount = msg.properties.headers?.['x-retry-count'] || 0
          const maxRetries = 3

          logger.error(`[VIDEO-WORKER] ❌ Error processing job ${messageData.jobId}:`, error)
          logger.error(`[VIDEO-WORKER] 📚 Full error:`, error instanceof Error ? error.stack : error)

          if (retryCount >= maxRetries) {
            // Max retries reached - mark as failed permanently
            logger.error(`[VIDEO-WORKER] 🚫 Max retries (${maxRetries}) reached for job ${messageData.jobId}, marking as failed`)

            // Update job in database as failed
            try {
              // Get product to use its MongoDB _id
              const product = await Product.findOne({ productId: messageData.productId })
              if (product) {
                await Job.findOneAndUpdate(
                  { productId: product._id, type: 'generate_video' },
                  {
                    $set: {
                      status: 'failed',
                      error: error instanceof Error ? error.message : 'Unknown error',
                      completedAt: new Date(),
                    },
                  }
                )
                logger.info(`[VIDEO-WORKER] 💾 Job status updated to failed in database`)
              }
            } catch (updateError) {
              logger.error('[VIDEO-WORKER] ❌ Failed to update job status:', updateError)
            }

            logger.info(`[VIDEO-WORKER] 🗑️  Discarding message (no requeue)`)
            // Don't requeue - message will be discarded
            channel.nack(msg, false, false)
          } else {
            // Retry - but we need to republish with updated retry count
            logger.warn(`[VIDEO-WORKER] 🔄 Retry ${retryCount + 1}/${maxRetries} for job ${messageData.jobId}`)

            try {
              // Publish new message with incremented retry count
              const newHeaders = {
                ...(msg.properties.headers || {}),
                'x-retry-count': retryCount + 1,
              }

              channel.sendToQueue(
                QUEUE_NAMES.VIDEO,
                msg.content,
                {
                  ...msg.properties,
                  headers: newHeaders,
                }
              )

              logger.info(`[VIDEO-WORKER] ✅ Requeued job ${messageData.jobId} with retry count ${retryCount + 1}`)

              // Acknowledge original message (we've republished it)
              channel.ack(msg)
            } catch (requeueError) {
              logger.error('[VIDEO-WORKER] ❌ Failed to requeue message:', requeueError)
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
  } catch (error) {
    logger.error('❌ Failed to start video worker:', error)
  }
}

/**
 * Get video generation job stats
 */
export const getVideoJobStats = async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      Job.countDocuments({ type: 'generate_video', status: 'waiting' }),
      Job.countDocuments({ type: 'generate_video', status: 'active' }),
      Job.countDocuments({ type: 'generate_video', status: 'completed' }),
      Job.countDocuments({ type: 'generate_video', status: 'failed' }),
    ])

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    }
  } catch (error) {
    logger.error('Failed to get video job stats:', error)
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
    }
  }
}

export default {
  startVideoWorker,
  getVideoJobStats,
}

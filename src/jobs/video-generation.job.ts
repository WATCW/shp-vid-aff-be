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
  const { productId, videoId, templateId, customConfig, jobId } = messageData

  logger.info(`[VIDEO-WORKER] Processing job ${jobId} for video: ${videoId}`)

  try {
    // Update job status
    await Job.findOneAndUpdate(
      { productId, type: 'video_generation', status: { $ne: 'completed' } },
      {
        $set: { status: 'active', startedAt: new Date() },
        $inc: { attempts: 1 },
      }
    )

    // Get product
    const product = await Product.findOne({ productId })

    if (!product) {
      throw new Error(`Product not found: ${productId}`)
    }

    if (!product.aiContent) {
      throw new Error(`Product ${productId} does not have AI content`)
    }

    // Update progress
    const updateProgress = async (progress: number) => {
      await Job.findOneAndUpdate(
        { productId, type: 'video_generation', status: 'active' },
        { $set: { progress } }
      )

      // Also update video record progress
      await Video.findById(videoId).then((video) => {
        if (video) {
          video.progress = progress
          return video.save()
        }
      })
    }

    // Generate video with progress callback
    logger.info(`[VIDEO-WORKER] Generating video for product: ${productId}`)

    const video = await videoGeneratorService.generateVideo(
      {
        productId: product._id.toString(),
        templateId,
        musicId: customConfig?.musicId,
        customText: customConfig?.customText,
      },
      updateProgress
    )

    // Update job record
    await Job.findOneAndUpdate(
      { productId, type: 'video_generation', status: 'active' },
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

    logger.info(`[VIDEO-WORKER]  Video generated successfully: ${videoId}`)

    return {
      success: true,
      videoId: video._id,
      productId,
      output: video.output,
    }
  } catch (error: any) {
    logger.error(`[VIDEO-WORKER] L Error generating video ${videoId}:`, error)

    // Update job as failed
    await Job.findOneAndUpdate(
      { productId, type: 'video_generation' },
      {
        $set: {
          status: 'failed',
          error: error.message || 'Video generation failed',
          completedAt: new Date(),
        },
      }
    )

    // Update video record as failed
    await Video.findById(videoId).then((video) => {
      if (video) {
        video.status = 'failed'
        video.error = error.message || 'Video generation failed'
        return video.save()
      }
    })

    throw error
  }
}

/**
 * Start video generation worker
 */
export const startVideoWorker = async () => {
  if (!rabbitmqAvailable) {
    logger.warn('   RabbitMQ not available - Video worker disabled')
    return
  }

  const channel = getChannel()

  if (!channel) {
    logger.error('L Cannot start video worker - No RabbitMQ channel')
    return
  }

  try {
    // Set prefetch to 1 (process one job at a time per worker)
    await channel.prefetch(1)

    logger.info(`<¬ Video generation worker started - Listening on queue: ${QUEUE_NAMES.VIDEO}`)

    // Start consuming messages
    await channel.consume(
      QUEUE_NAMES.VIDEO,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return

        try {
          const messageData = JSON.parse(msg.content.toString())
          await processVideoGenerationJob(messageData)

          // Acknowledge message on success
          channel.ack(msg)
        } catch (error) {
          logger.error('[VIDEO-WORKER] Error processing message:', error)

          // Reject and don't requeue if it's already been retried
          const retryCount = msg.properties.headers?.['x-retry-count'] || 0

          if (retryCount >= 3) {
            logger.error(`[VIDEO-WORKER] Max retries reached for job, rejecting...`)
            channel.nack(msg, false, false) // Don't requeue
          } else {
            logger.warn(`[VIDEO-WORKER] Retry ${retryCount + 1}/3 for job`)
            // Requeue with retry count
            channel.nack(msg, false, true)
          }
        }
      },
      {
        noAck: false, // Manual acknowledgment
      }
    )
  } catch (error) {
    logger.error('L Failed to start video worker:', error)
  }
}

/**
 * Get video generation job stats
 */
export const getVideoJobStats = async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      Job.countDocuments({ type: 'video_generation', status: 'waiting' }),
      Job.countDocuments({ type: 'video_generation', status: 'active' }),
      Job.countDocuments({ type: 'video_generation', status: 'completed' }),
      Job.countDocuments({ type: 'video_generation', status: 'failed' }),
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

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
      { productId, type: 'generate_video', status: { $ne: 'completed' } },
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
        { productId, type: 'generate_video', status: 'active' },
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
      { productId, type: 'generate_video', status: 'active' },
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
      { productId, type: 'generate_video' },
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

import { Elysia, t } from 'elysia'
import videoGeneratorService from '@services/video-generator.service'
import { addVideoJob } from '@jobs/queue'
import Video from '@models/video.model'
import { Job } from '@models/job.model'
import logger from '@utils/logger'

export const videoRoutes = new Elysia({ prefix: '/videos' })
  /**
   * Get all videos with pagination and filters
   */
  .get(
    '/',
    async ({ query }) => {
      try {
        const {
          page = '1',
          limit = '20',
          status,
          productId,
          sortBy = 'createdAt',
          sortOrder = 'desc',
        } = query

        const pageNum = parseInt(page)
        const limitNum = parseInt(limit)
        const skip = (pageNum - 1) * limitNum

        // Build filter
        const filter: any = {}

        if (status) {
          filter.status = status
        }

        if (productId) {
          filter.productId = productId
        }

        // Build sort
        const sort: any = {}
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1

        // Execute query
        const [videos, total] = await Promise.all([
          Video.find(filter)
            .populate('productId')
            .populate('templateId')
            .sort(sort)
            .limit(limitNum)
            .skip(skip)
            .lean(),
          Video.countDocuments(filter),
        ])

        return {
          success: true,
          data: videos,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        }
      } catch (error: any) {
        logger.error('Error getting videos:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch videos',
        }
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        status: t.Optional(t.String()),
        productId: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
      }),
    }
  )

  /**
   * Get a single video by ID
   */
  .get(
    '/:id',
    async ({ params }) => {
      try {
        const video = await videoGeneratorService.getVideoById(params.id)

        return {
          success: true,
          data: video,
        }
      } catch (error: any) {
        logger.error('Error getting video:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch video',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  /**
   * Get videos by product ID
   */
  .get(
    '/product/:productId',
    async ({ params }) => {
      try {
        const videos = await videoGeneratorService.getVideosByProductId(params.productId)

        return {
          success: true,
          data: videos,
        }
      } catch (error: any) {
        logger.error('Error getting videos by product:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch videos',
        }
      }
    },
    {
      params: t.Object({
        productId: t.String(),
      }),
    }
  )

  /**
   * Generate a new video
   */
  .post(
    '/generate',
    async ({ body }) => {
      try {
        const { productId, templateId, musicId, customText } = body

        logger.info('[VIDEO-GEN] 🎬 Starting video generation request:', {
          productId,
          templateId,
          musicId,
          customTextLength: customText?.length,
        })

        // Get product to validate and retrieve Shopify productId
        const { Product } = await import('@models/product.model')
        const product = await Product.findById(productId)

        if (!product) {
          throw new Error(`Product not found: ${productId}`)
        }

        logger.info('[VIDEO-GEN] ✅ Product found:', {
          mongoId: product._id,
          shopifyId: product.productId,
          name: product.name,
        })

        // Validate product has AI content
        if (!product.aiContent) {
          logger.error('[VIDEO-GEN] ❌ Product does not have AI content:', {
            productId: product.productId,
            name: product.name,
          })
          throw new Error('Product must have AI content generated before video can be created')
        }

        logger.info('[VIDEO-GEN] ✅ Product has AI content')

        // Validate product has images
        if (!product.images || product.images.length === 0) {
          logger.error('[VIDEO-GEN] ❌ Product has no images:', {
            productId: product.productId,
            name: product.name,
            images: product.images,
          })
          throw new Error('Product must have at least one image to generate video')
        }

        logger.info('[VIDEO-GEN] ✅ Product has images:', product.images.length)

        // Add to queue first to get jobId (same pattern as AI content)
        const jobId = await addVideoJob({
          productId: product.productId,
          templateId,
          customConfig: {
            musicId,
            customText,
          },
        })

        if (!jobId) {
          throw new Error('Failed to queue video generation job: RabbitMQ is not available')
        }

        logger.info(`[VIDEO-GEN] ✅ Video generation job queued: ${jobId}`)

        // Create job record in DB with the custom jobId
        const job = new Job({
          jobId, // Store custom job ID
          productId: product._id,
          type: 'generate_video',
          status: 'waiting',
          progress: 0,
        })

        await job.save()
        logger.info('[VIDEO-GEN] 💾 Job record saved:', job._id)

        return {
          success: true,
          message: 'Video generation job queued',
          data: {
            jobId,
            dbJobId: job._id.toString(),
            status: 'queued',
          },
        }
      } catch (error: any) {
        logger.error('Error queuing video generation:', error)
        return {
          success: false,
          error: error.message || 'Failed to queue video generation',
        }
      }
    },
    {
      body: t.Object({
        productId: t.String(),
        templateId: t.Optional(t.String()),
        musicId: t.Optional(t.String()),
        customText: t.Optional(t.Array(t.String())),
      }),
    }
  )

  /**
   * Get video generation status
   */
  .get(
    '/status/:videoId',
    async ({ params }) => {
      try {
        const video = await Video.findById(params.videoId)
          .populate('productId')
          .populate('templateId')
          .lean()

        if (!video) {
          return {
            success: false,
            error: 'Video not found',
          }
        }

        return {
          success: true,
          data: {
            videoId: video._id,
            status: video.status,
            progress: video.progress,
            error: video.error,
            output: video.output,
            renderTime: video.renderTime,
          },
        }
      } catch (error: any) {
        logger.error('Error getting video status:', error)
        return {
          success: false,
          error: error.message || 'Failed to get video status',
        }
      }
    },
    {
      params: t.Object({
        videoId: t.String(),
      }),
    }
  )

  /**
   * Delete a video
   */
  .delete(
    '/:id',
    async ({ params }) => {
      try {
        await videoGeneratorService.deleteVideo(params.id)

        return {
          success: true,
          message: 'Video deleted successfully',
        }
      } catch (error: any) {
        logger.error('Error deleting video:', error)
        return {
          success: false,
          error: error.message || 'Failed to delete video',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  /**
   * Get video statistics
   */
  .get(
    '/stats/overview',
    async () => {
      try {
        const [total, queued, processing, completed, failed] = await Promise.all([
          Video.countDocuments(),
          Video.countDocuments({ status: 'queued' }),
          Video.countDocuments({ status: 'processing' }),
          Video.countDocuments({ status: 'completed' }),
          Video.countDocuments({ status: 'failed' }),
        ])

        // Get average render time
        const avgRenderTime = await Video.aggregate([
          { $match: { renderTime: { $exists: true } } },
          { $group: { _id: null, avgTime: { $avg: '$renderTime' } } },
        ])

        return {
          success: true,
          data: {
            total,
            queued,
            processing,
            completed,
            failed,
            averageRenderTime: avgRenderTime[0]?.avgTime || 0,
          },
        }
      } catch (error: any) {
        logger.error('Error getting video stats:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch video stats',
        }
      }
    }
  )

import { Elysia, t } from 'elysia'
import { Product } from '@models/product.model'
import { Job } from '@models/job.model'
import { addAIContentJob, queuesInitialized } from '@jobs/queue'
import logger from '@utils/logger'
import { AIContentService } from '@services/ai-content.service'

export const aiRoutes = new Elysia({ prefix: '/ai' })
  /**
   * Generate AI content for products
   */
  .post(
    '/generate-content',
    async ({ body }) => {
      try {
        const { productIds, options } = body
        logger.info(`🤖 [AI] AI content generation request received for ${productIds.length} products`)

        // Check if queues are available
        if (!queuesInitialized) {
          logger.warn('⚠️  [AI] Queue system not available - Using synchronous processing')

          // Fallback to synchronous processing
          const aiService = new AIContentService()
          const results = []
          const errors = []

          for (const productId of productIds) {
            try {
              const product = await Product.findById(productId)

              if (!product) {
                errors.push({
                  productId,
                  error: 'Product not found',
                })
                continue
              }

              logger.info(`🔄 [AI] Processing ${product.name} synchronously...`)

              // Generate content directly
              const result = await aiService.generateContent({
                productName: product.name,
                productDescription: product.description,
                price: product.price,
                originalPrice: product.originalPrice,
                shopName: product.shopName,
                options,
              })

              // Update product with generated content
              product.aiContent = result
              product.aiGeneratedAt = new Date()
              await product.save()

              results.push({
                productId: product._id,
                productName: product.name,
                content: result,
              })

              logger.info(`✅ [AI] Content generated for ${product.name}`)

            } catch (error) {
              errors.push({
                productId,
                error: error instanceof Error ? error.message : 'Unknown error',
              })
              logger.error(`❌ [AI] Failed to generate content for ${productId}:`, error)
            }
          }

          return {
            success: results.length > 0,
            mode: 'synchronous',
            processed: results.length,
            failed: errors.length,
            results,
            errors: errors.length > 0 ? errors : undefined,
            message: 'Content generated synchronously (Queue unavailable)',
          }
        }

        logger.info(`✅ [AI] Queue system available, starting job creation...`)

        const jobs = []
        const errors = []

        for (const productId of productIds) {
          try {
            logger.info(`🔍 [AI] Processing product ${productId}...`)

            // Check if product exists
            const product = await Product.findById(productId)

            if (!product) {
              logger.warn(`❌ [AI] Product not found: ${productId}`)
              errors.push({
                productId,
                error: 'Product not found',
              })
              continue
            }

            logger.info(`✅ [AI] Product found: ${product.name}`)

            // Check if already processing
            const existingJob = await Job.findOne({
              productId: product._id,
              type: 'ai_content',
              status: { $in: ['waiting', 'active'] },
            })

            if (existingJob) {
              logger.warn(`⚠️  [AI] Job already in queue for product: ${product.productId} (status: ${existingJob.status})`)
              errors.push({
                productId,
                error: `มี job อยู่ในคิวแล้ว (สถานะ: ${existingJob.status})`,
                existingJobId: existingJob._id,
              })
              continue
            }

            // Create job record in DB
            logger.info(`💾 [AI] Creating job record in database...`)
            const jobRecord = await Job.create({
              type: 'ai_content',
              productId: product._id,
              status: 'waiting',
              data: { options },
            })
            logger.info(`✅ [AI] Job record created: ${jobRecord._id}`)

            // Queue job
            logger.info(`📤 [AI] Adding job to RabbitMQ queue...`)
            const jobId = await addAIContentJob(
              {
                productId: product.productId,
                options,
              },
              5 // Default priority
            )

            if (!jobId) {
              throw new Error('Failed to queue job to RabbitMQ')
            }

            logger.info(`✅ [AI] Job queued successfully: ${jobId}`)

            jobs.push({
              productId: product.productId,
              jobId,
              dbJobId: jobRecord._id,
            })

          } catch (error) {
            errors.push({
              productId,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            logger.error(`Failed to queue AI job for ${productId}:`, error)
          }
        }

        const estimatedTime = jobs.length * 10 // Rough estimate: 10 seconds per product

        logger.info(`🎉 [AI] Job creation completed. Queued: ${jobs.length}, Failed: ${errors.length}`)

        // If no jobs were created, return failure
        if (jobs.length === 0) {
          logger.error(`❌ [AI] No jobs were created. All ${errors.length} products failed.`)
          return {
            success: false,
            queued: 0,
            failed: errors.length,
            error: errors.length === 1
              ? errors[0].error
              : `ไม่สามารถสร้าง job ได้ทั้งหมด ${errors.length} สินค้า`,
            errors,
          }
        }

        return {
          success: true,
          queued: jobs.length,
          failed: errors.length,
          jobs,
          errors: errors.length > 0 ? errors : undefined,
          estimatedTime: `${estimatedTime}s`,
        }

      } catch (error) {
        logger.error('Failed to queue AI content jobs:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to queue jobs',
        }
      }
    },
    {
      body: t.Object({
        productIds: t.Array(t.String()),
        options: t.Optional(
          t.Object({
            tone: t.Optional(t.String()),
            style: t.Optional(t.String()),
            language: t.Optional(t.String()),
          })
        ),
      }),
      detail: {
        tags: ['AI'],
        summary: 'Generate AI content for products',
        description: 'Queue AI content generation jobs for multiple products',
      },
    }
  )

  /**
   * Get AI job status
   */
  .get(
    '/status/:jobId',
    async ({ params }) => {
      try {
        const bullJob = await aiContentQueue.getJob(params.jobId)

        if (!bullJob) {
          return {
            success: false,
            error: 'Job not found',
          }
        }

        const state = await bullJob.getState()
        const progress = bullJob.progress

        return {
          success: true,
          job: {
            id: bullJob.id,
            state,
            progress,
            data: bullJob.data,
            result: bullJob.returnvalue,
            failedReason: bullJob.failedReason,
          },
        }

      } catch (error) {
        logger.error('Failed to get job status:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get status',
        }
      }
    },
    {
      params: t.Object({
        jobId: t.String(),
      }),
      detail: {
        tags: ['AI'],
        summary: 'Get AI job status',
      },
    }
  )

  /**
   * Get existing jobs by products
   */
  .post(
    '/jobs/by-products',
    async ({ body }) => {
      try {
        const { productIds } = body
        logger.info(`🔍 [AI] Fetching jobs for ${productIds?.length || 0} products...`)

        if (!productIds || productIds.length === 0) {
          return {
            success: true,
            jobs: [],
          }
        }

        // Find products by their MongoDB IDs
        const products = await Product.find({ _id: { $in: productIds } })

        if (products.length === 0) {
          return {
            success: true,
            jobs: [],
          }
        }

        // Find jobs for these products
        const jobs = await Job.find({
          productId: { $in: products.map(p => p._id) },
          type: 'ai_content',
          status: { $in: ['waiting', 'active'] },
        }).sort({ createdAt: -1 })

        logger.info(`✅ [AI] Found ${jobs.length} active jobs`)

        // Map jobs to include productId
        const jobsWithProductId = jobs.map(job => {
          const product = products.find(p => p._id.toString() === job.productId.toString())
          return {
            jobId: job._id.toString(),
            productId: product?.productId || job.productId.toString(),
            status: job.status,
            createdAt: job.createdAt,
          }
        })

        return {
          success: true,
          jobs: jobsWithProductId,
        }

      } catch (error) {
        logger.error('❌ [AI] Failed to fetch jobs by products:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch jobs',
          jobs: [],
        }
      }
    },
    {
      body: t.Object({
        productIds: t.Array(t.String()),
      }),
      detail: {
        tags: ['AI'],
        summary: 'Get jobs by products',
        description: 'Fetch existing AI jobs for the given products',
      },
    }
  )

  /**
   * Clear/Cancel pending jobs for products
   */
  .delete(
	    '/jobs/clear',
	    async ({ body }) => {
	      try {
	        const { productIds } = body
        logger.info(`🗑️  [AI] Clearing pending jobs for ${productIds?.length || 'all'} products...`)

        let filter: any = {
          type: 'ai_content',
          status: { $in: ['waiting', 'active'] },
        }

        // If specific products are provided, filter by them
        if (productIds && productIds.length > 0) {
          const products = await Product.find({ _id: { $in: productIds } })
          filter.productId = { $in: products.map(p => p._id) }
          logger.info(`🔍 [AI] Found ${products.length} products to clear jobs for`)
        }

        // Update jobs to 'cancelled' status
        const result = await Job.updateMany(filter, {
          status: 'failed',
          error: 'Cancelled by user',
          completedAt: new Date()
        })

        logger.info(`✅ [AI] Cleared ${result.modifiedCount} pending jobs`)

        return {
          success: true,
          cleared: result.modifiedCount,
          message: `ล้าง ${result.modifiedCount} jobs สำเร็จ`
        }

      } catch (error) {
        logger.error('❌ [AI] Failed to clear jobs:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear jobs',
        }
      }
    },
    {
      body: t.Object({
        productIds: t.Optional(t.Array(t.String())),
      }),
      detail: {
        tags: ['AI'],
        summary: 'Clear pending AI jobs',
        description: 'Cancel/clear pending or active AI jobs for products',
      },
    }
  )

  /**
   * Regenerate AI content for a product
   */
  .post(
    '/regenerate/:productId',
    async ({ params, body }) => {
      try {
        const product = await Product.findById(params.productId)

        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          }
        }

        // Create job record
        const jobRecord = await Job.create({
          type: 'ai_content',
          productId: product._id,
          status: 'waiting',
          data: { options: body },
        })

        // Queue job
        const bullJob = await addAIContentJob(
          {
            productId: product.productId,
            options: body,
          },
          8 // Higher priority for regeneration
        )

        return {
          success: true,
          jobId: bullJob.id,
          dbJobId: jobRecord._id,
        }

      } catch (error) {
        logger.error('Failed to regenerate AI content:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to regenerate',
        }
      }
    },
    {
      params: t.Object({
        productId: t.String(),
      }),
      body: t.Object({
        tone: t.Optional(t.String()),
        style: t.Optional(t.String()),
        language: t.Optional(t.String()),
      }),
      detail: {
        tags: ['AI'],
        summary: 'Regenerate AI content',
      },
    }
  )

  /**
   * Get queue statistics
   */
  .get(
    '/queue/stats',
    async () => {
      try {
        const counts = await aiContentQueue.getJobCounts()

        return {
          success: true,
          stats: counts,
        }

      } catch (error) {
        logger.error('Failed to get queue stats:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get stats',
        }
      }
    },
    {
      detail: {
        tags: ['AI'],
        summary: 'Get AI queue statistics',
      },
    }
  )

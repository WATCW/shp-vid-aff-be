import { Elysia, t } from 'elysia'
import facebookService from '@services/facebook.service'
import { FacebookPost } from '@models/facebook-post.model'
import { Product } from '@models/product.model'
import logger from '@utils/logger'

export const facebookRoutes = new Elysia({ prefix: '/facebook' })
  /**
   * POST /api/facebook/post
   * สร้างโพสต์ไป Facebook Page
   */
  .post(
    '/post',
    async ({ body, set }) => {
      try {
        const { productId, caption, hashtags, productUrl, images } = body

        // Validate required fields
        if (!caption || !productUrl) {
          set.status = 400
          return {
            success: false,
            error: 'Missing required fields: caption or productUrl',
          }
        }

        // productId is now required to fetch product images if no images provided
        if (!productId) {
          set.status = 400
          return {
            success: false,
            error: 'productId is required',
          }
        }

        // Get product info first
        const product = await Product.findById(productId)
        if (!product) {
          set.status = 404
          return {
            success: false,
            error: 'Product not found',
          }
        }

        // Parse hashtags if it's a string
        let hashtagsArray: string[] = []
        try {
          hashtagsArray = typeof hashtags === 'string' ? JSON.parse(hashtags) : hashtags
        } catch (e) {
          logger.warn('[Facebook] Invalid hashtags format, using empty array')
          hashtagsArray = []
        }

        // Determine which images to use
        let imageBuffers: Buffer[] = []
        let imageUrls: string[] = []

        if (images && Array.isArray(images) && images.length > 0) {
          // Use uploaded images
          logger.info('[Facebook] Using uploaded images:', images.length)
          for (const image of images) {
            logger.info(`[Facebook] Processing image: ${image.name}, size: ${image.size}`)
            const arrayBuffer = await image.arrayBuffer()
            imageBuffers.push(Buffer.from(arrayBuffer))
          }
        } else {
          // No uploaded images - use product images (scraped or fallback)
          logger.info('[Facebook] No uploaded images, using product images')

          // Collect images from scrapedData
          if (product.scrapedData?.images && product.scrapedData.images.length > 0) {
            imageUrls.push(...product.scrapedData.images)
            logger.info(`[Facebook] Found ${product.scrapedData.images.length} scraped images`)
          }

          // Collect images from fallbackImages
          if (product.fallbackImages?.images && product.fallbackImages.images.length > 0) {
            imageUrls.push(...product.fallbackImages.images)
            logger.info(`[Facebook] Found ${product.fallbackImages.images.length} fallback images`)
          }

          if (imageUrls.length === 0) {
            set.status = 400
            return {
              success: false,
              error: 'No images available. Please upload images or ensure product has images.',
            }
          }

          logger.info(`[Facebook] Total product images: ${imageUrls.length}`)
        }

        logger.info('[Facebook] Creating post:', {
          productId,
          caption: caption.substring(0, 50) + '...',
          hashtagsCount: hashtagsArray.length,
          uploadedImagesCount: imageBuffers.length,
          scrapedImagesCount: imageUrls.length,
        })

        // Create Facebook post history record (pending)
        const facebookPost = new FacebookPost({
          productId: product._id,
          productName: product.name,
          productPrice: product.price,
          productUrl: product.productUrl,
          affiliateUrl: product.affiliateUrl,
          caption,
          hashtags: hashtagsArray,
          status: 'pending',
        })

        try {
          // If using scraped images, download them to buffers
          if (imageUrls.length > 0) {
            logger.info(`[Facebook] Downloading ${imageUrls.length} images from URLs...`)
            const axios = (await import('axios')).default

            for (const url of imageUrls) {
              try {
                const response = await axios.get(url, { responseType: 'arraybuffer' })
                imageBuffers.push(Buffer.from(response.data))
                logger.info(`[Facebook] Downloaded image: ${url.substring(0, 50)}...`)
              } catch (downloadError) {
                logger.error(`[Facebook] Failed to download image: ${url}`, downloadError)
              }
            }

            if (imageBuffers.length === 0) {
              throw new Error('Failed to download any product images')
            }
          }

          // Create Facebook post
          const result = await facebookService.createPost({
            caption,
            hashtags: hashtagsArray,
            productUrl,
            images: imageBuffers,
          })

          // Update history record with success
          facebookPost.status = 'success'
          facebookPost.facebookPostId = result.postId
          facebookPost.facebookPhotoIds = result.photoIds || (result.photoId ? [result.photoId] : [])
          facebookPost.postedAt = new Date()
          await facebookPost.save()

          // Update product status
          product.facebookPosted = true
          product.facebookPostId = result.postId
          product.facebookPostedAt = new Date()
          await product.save()

          logger.info('[Facebook] Post successful and saved to history:', result.postId)

          return {
            success: true,
            data: result,
            message: 'โพสต์ไป Facebook สำเร็จ!',
          }
        } catch (postError) {
          // Update history record with failure
          facebookPost.status = 'failed'
          facebookPost.errorMessage = postError instanceof Error ? postError.message : 'Unknown error'
          facebookPost.errorCode = (postError as any)?.code
          await facebookPost.save()

          logger.error('[Facebook] Post failed:', postError)
          throw postError
        }
      } catch (error) {
        logger.error('[Facebook] Post error:', error)

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: (error as any)?.code,
          type: (error as any)?.type,
        }
      }
    },
    {
      body: t.Object({
        productId: t.String(),
        caption: t.String(),
        hashtags: t.Any(), // Can be string or array
        productUrl: t.String(),
        images: t.Optional(t.Files()),
      }),
      detail: {
        tags: ['Facebook'],
        summary: 'Create Facebook post',
        description: 'สร้างโพสต์ไปยัง Facebook Page พร้อมรูปภาพ, caption, และ hashtags',
      },
    }
  )

  /**
   * GET /api/facebook/page-info
   * ดูข้อมูล Facebook Page
   */
  .get(
    '/page-info',
    async ({ set }) => {
      try {
        const pageInfo = await facebookService.getPageInfo()

        return {
          success: true,
          data: pageInfo,
        }
      } catch (error) {
        logger.error('[Facebook] Page info error:', error)

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
    {
      detail: {
        tags: ['Facebook'],
        summary: 'Get Facebook Page info',
        description: 'ดูข้อมูล Facebook Page (ชื่อ, จำนวนผู้ติดตาม, ฯลฯ)',
      },
    }
  )

  /**
   * GET /api/facebook/post/:postId
   * ดูสถานะโพสต์
   */
  .get(
    '/post/:postId',
    async ({ params, set }) => {
      try {
        const { postId } = params

        if (!postId) {
          set.status = 400
          return {
            success: false,
            error: 'Post ID is required',
          }
        }

        const postData = await facebookService.getPostStatus(postId)

        return {
          success: true,
          data: postData,
        }
      } catch (error) {
        logger.error('[Facebook] Get post status error:', error)

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
    {
      params: t.Object({
        postId: t.String(),
      }),
      detail: {
        tags: ['Facebook'],
        summary: 'Get Facebook post status',
        description: 'ดูสถานะและข้อมูลของโพสต์ Facebook',
      },
    }
  )

  /**
   * GET /api/facebook/posts
   * ดูรายการโพสต์ล่าสุด
   */
  .get(
    '/posts',
    async ({ query, set }) => {
      try {
        const limit = parseInt(query.limit as string) || 10

        const posts = await facebookService.listPosts(limit)

        return {
          success: true,
          data: posts.data,
          paging: posts.paging,
        }
      } catch (error) {
        logger.error('[Facebook] List posts error:', error)

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Facebook'],
        summary: 'List Facebook posts',
        description: 'ดูรายการโพสต์ล่าสุดจาก Facebook Page',
      },
    }
  )

  /**
   * GET /api/facebook/validate-token
   * ตรวจสอบความถูกต้องของ Access Token
   */
  .get(
    '/validate-token',
    async ({ set }) => {
      try {
        const tokenInfo = await facebookService.validateToken()

        return {
          success: true,
          data: tokenInfo,
        }
      } catch (error) {
        logger.error('[Facebook] Validate token error:', error)

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
    {
      detail: {
        tags: ['Facebook'],
        summary: 'Validate Facebook access token',
        description: 'ตรวจสอบความถูกต้องและวันหมดอายุของ Access Token',
      },
    }
  )

  /**
   * GET /api/facebook/history
   * ดูประวัติการโพสต์ Facebook
   */
  .get(
    '/history',
    async ({ query, set }) => {
      try {
        const limit = parseInt(query.limit as string) || 20
        const skip = parseInt(query.skip as string) || 0
        const status = query.status as string

        const filter: any = {}
        if (status && ['success', 'failed', 'pending'].includes(status)) {
          filter.status = status
        }

        const [posts, total] = await Promise.all([
          FacebookPost.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .populate('productId', 'name price productUrl'),
          FacebookPost.countDocuments(filter),
        ])

        return {
          success: true,
          data: posts,
          pagination: {
            total,
            limit,
            skip,
            hasMore: skip + posts.length < total,
          },
        }
      } catch (error) {
        logger.error('[Facebook] Get history error:', error)

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        skip: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
      detail: {
        tags: ['Facebook'],
        summary: 'Get Facebook post history',
        description: 'ดูประวัติการโพสต์ Facebook พร้อม filter และ pagination',
      },
    }
  )

  /**
   * GET /api/facebook/history/:id
   * ดูรายละเอียดประวัติการโพสต์เฉพาะ
   */
  .get(
    '/history/:id',
    async ({ params, set }) => {
      try {
        const post = await FacebookPost.findById(params.id).populate('productId')

        if (!post) {
          set.status = 404
          return {
            success: false,
            error: 'Post history not found',
          }
        }

        return {
          success: true,
          data: post,
        }
      } catch (error) {
        logger.error('[Facebook] Get history detail error:', error)

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ['Facebook'],
        summary: 'Get Facebook post history detail',
        description: 'ดูรายละเอียดประวัติการโพสต์ Facebook ตาม ID',
      },
    }
  )

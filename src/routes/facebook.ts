import { Elysia, t } from 'elysia'
import facebookService from '@services/facebook.service'
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

        if (!images || images.length === 0) {
          set.status = 400
          return {
            success: false,
            error: 'At least one image is required',
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

        // Convert File objects to Buffers
        const imageBuffers: Buffer[] = []
        for (const image of images) {
          const arrayBuffer = await image.arrayBuffer()
          imageBuffers.push(Buffer.from(arrayBuffer))
        }

        logger.info('[Facebook] Creating post:', {
          productId,
          caption: caption.substring(0, 50) + '...',
          hashtagsCount: hashtagsArray.length,
          imagesCount: imageBuffers.length,
        })

        // Create Facebook post
        const result = await facebookService.createPost({
          caption,
          hashtags: hashtagsArray,
          productUrl,
          images: imageBuffers,
        })

        return {
          success: true,
          data: result,
          message: 'โพสต์ไป Facebook สำเร็จ!',
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
        productId: t.Optional(t.String()),
        caption: t.String(),
        hashtags: t.Any(), // Can be string or array
        productUrl: t.String(),
        images: t.Files(),
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

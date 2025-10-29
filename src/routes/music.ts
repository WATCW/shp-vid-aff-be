import { Elysia, t } from 'elysia'
import assetManagerService from '@services/asset-manager.service'
import logger from '@utils/logger'

export const musicRoutes = new Elysia({ prefix: '/music' })
  /**
   * Get all music tracks with pagination and filters
   */
  .get(
    '/',
    async ({ query }) => {
      try {
        const {
          page,
          limit,
          category,
          isPremium,
          minDuration,
          maxDuration,
          sortBy,
          sortOrder,
        } = query

        const filters = {
          category,
          isPremium: isPremium ? isPremium === 'true' : undefined,
          minDuration: minDuration ? parseInt(minDuration) : undefined,
          maxDuration: maxDuration ? parseInt(maxDuration) : undefined,
        }

        const options = {
          page: page ? parseInt(page) : undefined,
          limit: limit ? parseInt(limit) : undefined,
          sortBy,
          sortOrder,
        }

        const result = await assetManagerService.getMusic(filters, options)

        return {
          success: true,
          data: result.music,
          pagination: result.pagination,
        }
      } catch (error: any) {
        logger.error('Error getting music:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch music',
        }
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        limit: t.Optional(t.String()),
        category: t.Optional(t.String()),
        isPremium: t.Optional(t.String()),
        minDuration: t.Optional(t.String()),
        maxDuration: t.Optional(t.String()),
        sortBy: t.Optional(t.String()),
        sortOrder: t.Optional(t.String()),
      }),
    }
  )

  /**
   * Get a single music track by ID
   */
  .get(
    '/:id',
    async ({ params }) => {
      try {
        const music = await assetManagerService.getMusicById(params.id)

        return {
          success: true,
          data: music,
        }
      } catch (error: any) {
        logger.error('Error getting music:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch music',
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
   * Get music by category
   */
  .get(
    '/category/:category',
    async ({ params }) => {
      try {
        const music = await assetManagerService.getMusicByCategory(params.category)

        return {
          success: true,
          data: music,
        }
      } catch (error: any) {
        logger.error('Error getting music by category:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch music',
        }
      }
    },
    {
      params: t.Object({
        category: t.String(),
      }),
    }
  )

  /**
   * Get random music track
   */
  .get(
    '/random',
    async ({ query }) => {
      try {
        const { category } = query
        const music = await assetManagerService.getRandomMusic(category)

        return {
          success: true,
          data: music,
        }
      } catch (error: any) {
        logger.error('Error getting random music:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch random music',
        }
      }
    },
    {
      query: t.Object({
        category: t.Optional(t.String()),
      }),
    }
  )

  /**
   * Get music categories
   */
  .get(
    '/meta/categories',
    async () => {
      try {
        const categories = await assetManagerService.getMusicCategories()

        return {
          success: true,
          data: categories,
        }
      } catch (error: any) {
        logger.error('Error getting music categories:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch categories',
        }
      }
    }
  )

  /**
   * Get fonts list
   */
  .get(
    '/fonts',
    async () => {
      try {
        const fonts = await assetManagerService.listFonts()

        return {
          success: true,
          data: fonts,
        }
      } catch (error: any) {
        logger.error('Error getting fonts:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch fonts',
        }
      }
    }
  )

  /**
   * Get images list
   */
  .get(
    '/images',
    async () => {
      try {
        const images = await assetManagerService.listImages()

        return {
          success: true,
          data: images,
        }
      } catch (error: any) {
        logger.error('Error getting images:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch images',
        }
      }
    }
  )

  /**
   * Get asset statistics
   */
  .get(
    '/stats/overview',
    async () => {
      try {
        const stats = await assetManagerService.getStats()

        return {
          success: true,
          data: stats,
        }
      } catch (error: any) {
        logger.error('Error getting asset stats:', error)
        return {
          success: false,
          error: error.message || 'Failed to fetch asset stats',
        }
      }
    }
  )

  /**
   * Create a new music entry (Admin only)
   */
  .post(
    '/',
    async ({ body }) => {
      try {
        const music = await assetManagerService.createMusic(body)

        return {
          success: true,
          message: 'Music created successfully',
          data: music,
        }
      } catch (error: any) {
        logger.error('Error creating music:', error)
        return {
          success: false,
          error: error.message || 'Failed to create music',
        }
      }
    },
    {
      body: t.Any(),
    }
  )

  /**
   * Update music entry (Admin only)
   */
  .patch(
    '/:id',
    async ({ params, body }) => {
      try {
        const music = await assetManagerService.updateMusic(params.id, body)

        return {
          success: true,
          message: 'Music updated successfully',
          data: music,
        }
      } catch (error: any) {
        logger.error('Error updating music:', error)
        return {
          success: false,
          error: error.message || 'Failed to update music',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Any(),
    }
  )

  /**
   * Delete music (Admin only)
   */
  .delete(
    '/:id',
    async ({ params }) => {
      try {
        await assetManagerService.deleteMusic(params.id)

        return {
          success: true,
          message: 'Music deleted successfully',
        }
      } catch (error: any) {
        logger.error('Error deleting music:', error)
        return {
          success: false,
          error: error.message || 'Failed to delete music',
        }
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

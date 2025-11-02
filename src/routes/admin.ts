import { Elysia } from 'elysia'
import { Product } from '@models/product.model'
import logger from '@utils/logger'

export const adminRoutes = new Elysia({ prefix: '/admin' })
  /**
   * Cleanup expired DALL-E image URLs (POST method)
   * DALL-E URLs expire after 1-2 hours, causing 403 errors
   */
  .post('/cleanup-dalle-images', async () => {
    try {
      logger.info('[ADMIN] 🧹 Starting DALL-E image cleanup...')

      // Find products with DALL-E URLs in fallback images
      const productsWithDalleImages = await Product.find({
        'fallbackImages.images': {
          $elemMatch: {
            $regex: 'oaidalleapiprodscus.blob.core.windows.net',
          },
        },
      })

      logger.info(`[ADMIN] Found ${productsWithDalleImages.length} products with DALL-E URLs`)

      if (productsWithDalleImages.length === 0) {
        return {
          success: true,
          message: 'No products with expired DALL-E URLs found',
          stats: {
            found: 0,
            cleaned: 0,
            failed: 0,
          },
        }
      }

      // Remove fallback images from these products
      const results = {
        cleaned: [] as string[],
        failed: [] as string[],
      }

      for (const product of productsWithDalleImages) {
        try {
          logger.info(`[ADMIN] Cleaning product: ${product.name} (${product.productId})`)

          await Product.findByIdAndUpdate(product._id, {
            $unset: { fallbackImages: 1 },
          })

          results.cleaned.push(product.productId)
          logger.info(`[ADMIN] ✅ Cleaned product ${product.productId}`)
        } catch (error) {
          logger.error(`[ADMIN] ❌ Error cleaning product ${product.productId}:`, error)
          results.failed.push(product.productId)
        }
      }

      return {
        success: true,
        message: 'DALL-E image cleanup completed',
        stats: {
          found: productsWithDalleImages.length,
          cleaned: results.cleaned.length,
          failed: results.failed.length,
        },
        details: {
          cleanedProducts: results.cleaned,
          failedProducts: results.failed,
        },
        note: 'Images will be automatically regenerated (and saved permanently) next time you generate a video for these products.',
      }
    } catch (error: any) {
      logger.error('[ADMIN] ❌ Error during cleanup:', error)
      return {
        success: false,
        error: error.message || 'Failed to cleanup DALL-E images',
      }
    }
  })

  /**
   * Cleanup expired DALL-E image URLs (GET method for easy browser access)
   * DALL-E URLs expire after 1-2 hours, causing 403 errors
   */
  .get('/cleanup-dalle-images', async () => {
    try {
      logger.info('[ADMIN] 🧹 Starting DALL-E image cleanup (GET)...')

      // Find products with DALL-E URLs in fallback images
      const productsWithDalleImages = await Product.find({
        'fallbackImages.images': {
          $elemMatch: {
            $regex: 'oaidalleapiprodscus.blob.core.windows.net',
          },
        },
      })

      logger.info(`[ADMIN] Found ${productsWithDalleImages.length} products with DALL-E URLs`)

      if (productsWithDalleImages.length === 0) {
        return {
          success: true,
          message: 'No products with expired DALL-E URLs found',
          stats: {
            found: 0,
            cleaned: 0,
            failed: 0,
          },
        }
      }

      // Remove fallback images from these products
      const results = {
        cleaned: [] as string[],
        failed: [] as string[],
      }

      for (const product of productsWithDalleImages) {
        try {
          logger.info(`[ADMIN] Cleaning product: ${product.name} (${product.productId})`)

          await Product.findByIdAndUpdate(product._id, {
            $unset: { fallbackImages: 1 },
          })

          results.cleaned.push(product.productId)
          logger.info(`[ADMIN] ✅ Cleaned product ${product.productId}`)
        } catch (error) {
          logger.error(`[ADMIN] ❌ Error cleaning product ${product.productId}:`, error)
          results.failed.push(product.productId)
        }
      }

      return {
        success: true,
        message: 'DALL-E image cleanup completed',
        stats: {
          found: productsWithDalleImages.length,
          cleaned: results.cleaned.length,
          failed: results.failed.length,
        },
        details: {
          cleanedProducts: results.cleaned,
          failedProducts: results.failed,
        },
        note: 'Images will be automatically regenerated (and saved permanently) next time you generate a video for these products.',
      }
    } catch (error: any) {
      logger.error('[ADMIN] ❌ Error during cleanup:', error)
      return {
        success: false,
        error: error.message || 'Failed to cleanup DALL-E images',
      }
    }
  })

  /**
   * Get products with expired DALL-E URLs (check without cleaning)
   */
  .get('/check-dalle-images', async () => {
    try {
      const productsWithDalleImages = await Product.find({
        'fallbackImages.images': {
          $elemMatch: {
            $regex: 'oaidalleapiprodscus.blob.core.windows.net',
          },
        },
      })
        .select('productId name fallbackImages')
        .lean()

      return {
        success: true,
        count: productsWithDalleImages.length,
        products: productsWithDalleImages.map((p) => ({
          productId: p.productId,
          name: p.name,
          imageCount: p.fallbackImages?.images?.length || 0,
          images: p.fallbackImages?.images?.map((url) => url.substring(0, 100) + '...') || [],
        })),
      }
    } catch (error: any) {
      logger.error('[ADMIN] Error checking DALL-E images:', error)
      return {
        success: false,
        error: error.message || 'Failed to check DALL-E images',
      }
    }
  })

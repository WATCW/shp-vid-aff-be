import { Elysia, t } from 'elysia'
import { Product } from '@models/product.model'
import logger from '@utils/logger'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'

const UPLOAD_PATH = process.env.UPLOAD_PATH || './storage/uploads'
const FALLBACK_IMAGES_PATH = path.join(UPLOAD_PATH, 'fallback-images')

// Ensure directories exist
fs.mkdir(FALLBACK_IMAGES_PATH, { recursive: true }).catch(err => {
  logger.error('[PRODUCT-IMAGES] Error creating directories:', err)
})

export const productImagesRoutes = new Elysia({ prefix: '/products/:id/images' })
  /**
   * Upload images for a product (manual upload)
   */
  .post(
    '/upload',
    async ({ params, body }: any) => {
      try {
        const { id: productId } = params

        logger.info(`[PRODUCT-IMAGES] 📤 Upload request for product: ${productId}`)

        // Find product
        const product = await Product.findById(productId)
        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          }
        }

        // Get uploaded files
        const files = Array.isArray(body.images) ? body.images : [body.images]

        if (!files || files.length === 0) {
          return {
            success: false,
            error: 'No images provided',
          }
        }

        logger.info(`[PRODUCT-IMAGES] Processing ${files.length} uploaded images...`)

        // Save images
        const savedImages: string[] = []

        for (let i = 0; i < files.length; i++) {
          const file = files[i]

          // Validate file type
          if (!file.type.startsWith('image/')) {
            logger.warn(`[PRODUCT-IMAGES] ⚠️  Skipping non-image file: ${file.name}`)
            continue
          }

          // Validate file size (10MB max)
          const maxSize = 10 * 1024 * 1024
          if (file.size > maxSize) {
            logger.warn(`[PRODUCT-IMAGES] ⚠️  Skipping large file: ${file.name} (${file.size} bytes)`)
            continue
          }

          // Generate unique filename
          const hash = crypto.createHash('md5').update(`${productId}-upload-${Date.now()}-${i}`).digest('hex')
          const ext = path.extname(file.name) || '.jpg'
          const filename = `${hash}${ext}`
          const filepath = path.join(FALLBACK_IMAGES_PATH, filename)

          // Save file
          const buffer = await file.arrayBuffer()
          await fs.writeFile(filepath, Buffer.from(buffer))

          // Store relative URL
          const relativeUrl = `/uploads/fallback-images/${filename}`
          savedImages.push(relativeUrl)

          logger.info(`[PRODUCT-IMAGES] ✅ Saved image ${i + 1}: ${relativeUrl}`)
        }

        if (savedImages.length === 0) {
          return {
            success: false,
            error: 'No valid images were uploaded',
          }
        }

        // Update product with fallback images
        await Product.findByIdAndUpdate(productId, {
          fallbackImages: {
            images: savedImages,
            source: 'manual_upload',
            generatedAt: new Date(),
          }
        })

        logger.info(`[PRODUCT-IMAGES] 🎉 Successfully uploaded ${savedImages.length} images`)

        return {
          success: true,
          message: `Successfully uploaded ${savedImages.length} images`,
          images: savedImages,
        }

      } catch (error: any) {
        logger.error('[PRODUCT-IMAGES] ❌ Error uploading images:', error)
        return {
          success: false,
          error: error.message || 'Failed to upload images',
        }
      }
    },
    {
      body: t.Object({
        images: t.Any(), // File or array of files
      }),
    }
  )

  /**
   * Get fallback images for a product
   */
  .get(
    '/',
    async ({ params }) => {
      try {
        const { id: productId } = params

        const product = await Product.findById(productId)
        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          }
        }

        return {
          success: true,
          fallbackImages: product.fallbackImages || null,
        }

      } catch (error: any) {
        logger.error('[PRODUCT-IMAGES] ❌ Error getting images:', error)
        return {
          success: false,
          error: error.message || 'Failed to get images',
        }
      }
    }
  )

  /**
   * Delete fallback images for a product
   */
  .delete(
    '/',
    async ({ params }) => {
      try {
        const { id: productId } = params

        const product = await Product.findById(productId)
        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          }
        }

        // Delete files from disk
        if (product.fallbackImages?.images) {
          for (const imageUrl of product.fallbackImages.images) {
            try {
              const filename = path.basename(imageUrl)
              const filepath = path.join(FALLBACK_IMAGES_PATH, filename)
              await fs.unlink(filepath)
              logger.info(`[PRODUCT-IMAGES] 🗑️  Deleted image: ${filename}`)
            } catch (err) {
              logger.warn(`[PRODUCT-IMAGES] ⚠️  Failed to delete image file: ${imageUrl}`)
            }
          }
        }

        // Remove from database
        await Product.findByIdAndUpdate(productId, {
          $unset: { fallbackImages: 1 }
        })

        logger.info(`[PRODUCT-IMAGES] ✅ Deleted fallback images for product: ${productId}`)

        return {
          success: true,
          message: 'Fallback images deleted successfully',
        }

      } catch (error: any) {
        logger.error('[PRODUCT-IMAGES] ❌ Error deleting images:', error)
        return {
          success: false,
          error: error.message || 'Failed to delete images',
        }
      }
    }
  )

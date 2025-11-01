import { connectDatabase } from '@config/database'
import { Product } from '@models/product.model'
import logger from '@utils/logger'

/**
 * Cleanup manual uploaded fallback images from database
 * These images are stored as local paths which don't work in ephemeral containers
 */
async function cleanupManualUploads() {
  try {
    logger.info('🧹 Starting cleanup of manual uploaded images...')

    await connectDatabase()

    // Find all products with manual_upload fallback images
    const productsWithManualUploads = await Product.find({
      'fallbackImages.source': 'manual_upload'
    })

    logger.info(`Found ${productsWithManualUploads.length} products with manual uploads`)

    for (const product of productsWithManualUploads) {
      logger.info(`Cleaning up product: ${product.name} (${product.productId})`)

      // Remove fallbackImages field
      await Product.findByIdAndUpdate(product._id, {
        $unset: { fallbackImages: 1 }
      })

      logger.info(`✅ Cleaned: ${product.name}`)
    }

    logger.info(`🎉 Cleanup complete! Removed manual uploads from ${productsWithManualUploads.length} products`)
    logger.info('ℹ️  These products will now use automatic image fetching (Pexels/DALL-E)')

    process.exit(0)

  } catch (error) {
    logger.error('❌ Error during cleanup:', error)
    process.exit(1)
  }
}

cleanupManualUploads()

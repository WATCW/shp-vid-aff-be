/**
 * Cleanup script to remove expired DALL-E image URLs from products
 *
 * DALL-E URLs expire after 1-2 hours, so any products with DALL-E URLs
 * stored directly will fail when generating videos.
 *
 * This script removes fallback images that came from DALL-E (oaidalleapiprodscus.blob.core.windows.net)
 * so they can be regenerated and properly saved next time.
 *
 * Usage: bun src/scripts/cleanup-dalle-images.ts
 */

import { connectDatabase } from '../config/database'
import { Product } from '../models/product.model'
import logger from '../utils/logger'

const cleanupDalleImages = async () => {
  try {
    logger.info('🧹 Starting DALL-E image cleanup...')

    // Connect to database
    await connectDatabase()

    // Find products with DALL-E URLs in fallback images
    const productsWithDalleImages = await Product.find({
      'fallbackImages.images': {
        $elemMatch: {
          $regex: 'oaidalleapiprodscus.blob.core.windows.net'
        }
      }
    })

    logger.info(`Found ${productsWithDalleImages.length} products with DALL-E URLs`)

    if (productsWithDalleImages.length === 0) {
      logger.info('✅ No products with DALL-E URLs found. Nothing to clean up.')
      process.exit(0)
    }

    // Remove fallback images from these products
    let cleanedCount = 0
    for (const product of productsWithDalleImages) {
      try {
        logger.info(`Cleaning product: ${product.name} (${product.productId})`)

        await Product.findByIdAndUpdate(product._id, {
          $unset: { fallbackImages: 1 }
        })

        cleanedCount++
        logger.info(`✅ Cleaned product ${product.productId}`)
      } catch (error) {
        logger.error(`❌ Error cleaning product ${product.productId}:`, error)
      }
    }

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info(`✅ Cleanup complete!`)
    logger.info(`   Products cleaned: ${cleanedCount}`)
    logger.info(`   Products failed: ${productsWithDalleImages.length - cleanedCount}`)
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    logger.info('')
    logger.info('ℹ️  Note: Images will be automatically regenerated next time you generate a video.')
    logger.info('   DALL-E images will now be downloaded and saved permanently.')

    process.exit(0)
  } catch (error) {
    logger.error('❌ Error during cleanup:', error)
    process.exit(1)
  }
}

// Run cleanup
cleanupDalleImages()

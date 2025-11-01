import { Product, IProduct } from '@models/product.model'
import imageSearchService from './image-search.service'
import imageGenerationService from './image-generation.service'
import logger from '@utils/logger'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'

/**
 * Orchestrates image fallback strategies:
 * 1. Check existing images (scrapedData + fallbackImages)
 * 2. Search from Pexels
 * 3. Generate with DALL-E
 * 4. Return null (manual upload required)
 */
export class ImageFallbackService {
  private storageBasePath = process.env.UPLOAD_PATH || './storage/uploads'
  private fallbackImagesPath = path.join(this.storageBasePath, 'fallback-images')

  constructor() {
    this.ensureStorageDirectories()
  }

  /**
   * Ensure storage directories exist
   */
  private async ensureStorageDirectories() {
    try {
      await fs.mkdir(this.fallbackImagesPath, { recursive: true })
    } catch (error) {
      logger.error('[IMAGE-FALLBACK] Error creating storage directories:', error)
    }
  }

  /**
   * Get all available images for a product
   */
  getAllProductImages(product: IProduct): string[] {
    const images: string[] = []

    // Add scraped images
    if (product.scrapedData?.images) {
      images.push(...product.scrapedData.images)
    }

    // Add fallback images
    if (product.fallbackImages?.images) {
      images.push(...product.fallbackImages.images)
    }

    return images
  }

  /**
   * Main fallback flow - try to get or generate images for product
   * Returns: array of image URLs, or null if manual upload needed
   */
  async ensureProductHasImages(productId: string): Promise<string[] | null> {
    try {
      logger.info(`[IMAGE-FALLBACK] 🔄 Starting fallback for product: ${productId}`)

      // Get product
      const product = await Product.findById(productId)
      if (!product) {
        throw new Error(`Product not found: ${productId}`)
      }

      // Step 1: Check if product already has images
      const existingImages = this.getAllProductImages(product)
      if (existingImages.length > 0) {
        logger.info(`[IMAGE-FALLBACK] ✅ Product already has ${existingImages.length} images`)
        return existingImages
      }

      logger.info('[IMAGE-FALLBACK] ⚠️  No existing images, trying fallback strategies...')

      // Step 2: Try searching from Pexels
      const searchResults = await imageSearchService.searchProductImages(product.name, 5)
      if (searchResults.length > 0) {
        logger.info(`[IMAGE-FALLBACK] 🔍 Found ${searchResults.length} images from search`)

        // Download and save images
        const savedImages = await this.saveSearchedImages(product, searchResults)
        if (savedImages.length > 0) {
          // Update product with fallback images
          await Product.findByIdAndUpdate(productId, {
            fallbackImages: {
              images: savedImages,
              source: 'search',
              searchQuery: product.name,
              generatedAt: new Date(),
            }
          })

          logger.info(`[IMAGE-FALLBACK] ✅ Saved ${savedImages.length} searched images`)
          return savedImages
        }
      }

      // Step 3: Try generating with DALL-E
      logger.info('[IMAGE-FALLBACK] 🎨 Trying AI image generation...')
      const generatedImage = await imageGenerationService.generateProductImage(product.name)

      if (generatedImage) {
        logger.info('[IMAGE-FALLBACK] ✅ Generated image with DALL-E')

        // Download and save generated image
        const savedImage = await this.saveGeneratedImage(product, generatedImage)
        if (savedImage) {
          // Update product with fallback images
          await Product.findByIdAndUpdate(productId, {
            fallbackImages: {
              images: [savedImage],
              source: 'ai_generated',
              searchQuery: generatedImage.prompt,
              generatedAt: new Date(),
            }
          })

          logger.info('[IMAGE-FALLBACK] ✅ Saved generated image')
          return [savedImage]
        }
      }

      // Step 4: All strategies failed - manual upload required
      logger.warn('[IMAGE-FALLBACK] ⚠️  All fallback strategies failed - manual upload required')
      return null

    } catch (error) {
      logger.error('[IMAGE-FALLBACK] ❌ Error in fallback flow:', error)
      return null
    }
  }

  /**
   * Save searched images - use direct URLs instead of downloading
   */
  private async saveSearchedImages(
    product: IProduct,
    searchResults: any[]
  ): Promise<string[]> {
    const savedUrls: string[] = []

    for (let i = 0; i < searchResults.length; i++) {
      try {
        const result = searchResults[i]

        // Use direct URL from Pexels (no download needed)
        // This avoids storage issues in ephemeral containers
        savedUrls.push(result.url)

        logger.info(`[IMAGE-FALLBACK] ✅ Using Pexels URL ${i + 1}: ${result.url.substring(0, 60)}...`)

      } catch (error) {
        logger.error(`[IMAGE-FALLBACK] ❌ Error processing searched image ${i}:`, error)
      }
    }

    return savedUrls
  }

  /**
   * Save generated image - download and save locally because DALL-E URLs expire
   */
  private async saveGeneratedImage(
    product: IProduct,
    generatedImage: any
  ): Promise<string | null> {
    try {
      // DALL-E URLs expire after 1-2 hours, so we MUST download and save them
      logger.info(`[IMAGE-FALLBACK] 📥 Downloading DALL-E image: ${generatedImage.url.substring(0, 60)}...`)

      // Download image
      const imageBuffer = await imageSearchService.downloadImage(generatedImage.url)

      // Generate filename
      const hash = crypto.createHash('md5').update(product._id.toString()).digest('hex').substring(0, 8)
      const timestamp = Date.now()
      const filename = `dalle-${hash}-${timestamp}.png`
      const filepath = path.join(this.fallbackImagesPath, filename)

      // Save to disk
      await fs.writeFile(filepath, imageBuffer)

      // Return relative URL for serving via static plugin
      const relativeUrl = `/storage/uploads/fallback-images/${filename}`
      logger.info(`[IMAGE-FALLBACK] ✅ Saved DALL-E image: ${relativeUrl}`)
      return relativeUrl

    } catch (error) {
      logger.error('[IMAGE-FALLBACK] ❌ Error downloading/saving generated image:', error)
      return null
    }
  }
}

export default new ImageFallbackService()

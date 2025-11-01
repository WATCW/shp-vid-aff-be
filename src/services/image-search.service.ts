import axios from 'axios'
import logger from '@utils/logger'

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || ''
const PEXELS_API_URL = 'https://api.pexels.com/v1'

export interface ImageSearchResult {
  url: string
  width: number
  height: number
  photographer: string
  source: string
}

/**
 * Search for product images using Pexels API
 */
export class ImageSearchService {
  /**
   * Search for images by product name
   */
  async searchProductImages(
    productName: string,
    limit: number = 5
  ): Promise<ImageSearchResult[]> {
    try {
      if (!PEXELS_API_KEY) {
        logger.warn('[IMAGE-SEARCH] ⚠️  Pexels API key not configured')
        return []
      }

      // Clean product name for search query
      const searchQuery = this.cleanProductName(productName)
      logger.info(`[IMAGE-SEARCH] 🔍 Searching for: "${searchQuery}"`)

      const response = await axios.get(`${PEXELS_API_URL}/search`, {
        headers: {
          Authorization: PEXELS_API_KEY,
        },
        params: {
          query: searchQuery,
          per_page: limit,
          orientation: 'landscape', // Better for video
        },
        timeout: 10000, // 10 seconds
      })

      if (!response.data.photos || response.data.photos.length === 0) {
        logger.info(`[IMAGE-SEARCH] ❌ No images found for: "${searchQuery}"`)
        return []
      }

      const images: ImageSearchResult[] = response.data.photos.map((photo: any) => ({
        url: photo.src.large, // Use large size for video quality
        width: photo.width,
        height: photo.height,
        photographer: photo.photographer,
        source: 'pexels',
      }))

      logger.info(`[IMAGE-SEARCH] ✅ Found ${images.length} images from Pexels`)
      return images

    } catch (error) {
      logger.error('[IMAGE-SEARCH] ❌ Error searching images:', error)
      return []
    }
  }

  /**
   * Clean product name for better search results
   * Remove special characters, brand names in Thai, etc.
   */
  private cleanProductName(productName: string): string {
    // Remove common Thai words that don't help with image search
    let cleaned = productName
      .replace(/[\[\]()]/g, '') // Remove brackets
      .replace(/\d+ml|\d+g|\d+kg/gi, '') // Remove weights
      .replace(/ขนาด|แพค|ชุด|เซ็ต/gi, '') // Remove Thai size words
      .trim()

    // If too long, take first few words
    const words = cleaned.split(' ')
    if (words.length > 4) {
      cleaned = words.slice(0, 4).join(' ')
    }

    logger.info(`[IMAGE-SEARCH] 🧹 Cleaned query: "${productName}" → "${cleaned}"`)
    return cleaned
  }

  /**
   * Download image from URL and return as buffer
   */
  async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds
      })
      return Buffer.from(response.data)
    } catch (error) {
      logger.error(`[IMAGE-SEARCH] ❌ Error downloading image from ${url}:`, error)
      throw error
    }
  }
}

export default new ImageSearchService()

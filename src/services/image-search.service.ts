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
   * Extract key product type and remove noise
   */
  private cleanProductName(productName: string): string {
    // Remove special characters, brackets, and measurements
    let cleaned = productName
      .replace(/[\[\](){}]/g, ' ')
      .replace(/\d+ml|\d+g|\d+kg|\d+oz|\d+L|\d+มล|\d+กรัม/gi, ' ')
      .replace(/ขนาด|แพค|ชุด|เซ็ต|ราคา|โปร|พิเศษ/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Extract meaningful words (remove very short words)
    const words = cleaned.split(' ').filter(w => w.length > 2)

    // Take first 3-4 meaningful words for focused search
    const keyWords = words.slice(0, Math.min(4, words.length))
    cleaned = keyWords.join(' ')

    // If query is still too generic or empty, try to extract brand/product type
    if (!cleaned || cleaned.length < 3) {
      // Use first few words from original name
      cleaned = productName.split(' ').slice(0, 3).join(' ')
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

import OpenAI from 'openai'
import logger from '@utils/logger'
import axios from 'axios'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

export interface GeneratedImage {
  url: string
  prompt: string
  revisedPrompt?: string
}

/**
 * Generate product images using DALL-E
 */
export class ImageGenerationService {
  private openai: OpenAI | null = null

  constructor() {
    if (OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: OPENAI_API_KEY,
      })
    } else {
      logger.warn('[IMAGE-GEN] ⚠️  OpenAI API key not configured')
    }
  }

  /**
   * Generate product image using DALL-E
   */
  async generateProductImage(productName: string): Promise<GeneratedImage | null> {
    try {
      if (!this.openai) {
        logger.error('[IMAGE-GEN] ❌ OpenAI not initialized')
        return null
      }

      // Create a prompt for product image
      const prompt = this.createProductImagePrompt(productName)
      logger.info(`[IMAGE-GEN] 🎨 Generating image with prompt: "${prompt}"`)

      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'natural', // More realistic product images
      })

      if (!response.data || response.data.length === 0) {
        logger.error('[IMAGE-GEN] ❌ No image generated')
        return null
      }

      const generatedImage = response.data[0]

      logger.info('[IMAGE-GEN] ✅ Image generated successfully')
      return {
        url: generatedImage.url!,
        prompt: prompt,
        revisedPrompt: generatedImage.revised_prompt,
      }

    } catch (error: any) {
      logger.error('[IMAGE-GEN] ❌ Error generating image:', error)

      // Check for specific errors
      if (error?.status === 429) {
        logger.error('[IMAGE-GEN] ⚠️  Rate limit exceeded')
      } else if (error?.status === 400) {
        logger.error('[IMAGE-GEN] ⚠️  Invalid prompt or parameters')
      }

      return null
    }
  }

  /**
   * Create an optimized prompt for product image generation
   */
  private createProductImagePrompt(productName: string): string {
    // Clean product name
    const cleanName = productName
      .replace(/[\[\]()]/g, '')
      .replace(/\d+ml|\d+g|\d+kg/gi, '')
      .trim()

    // Create detailed prompt for better product images
    return `A professional, high-quality product photography of ${cleanName}. Studio lighting, clean white background, centered composition, photorealistic, commercial product shot, 4k quality, sharp focus.`
  }

  /**
   * Download generated image from URL
   */
  async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds
      })
      return Buffer.from(response.data)
    } catch (error) {
      logger.error(`[IMAGE-GEN] ❌ Error downloading image from ${url}:`, error)
      throw error
    }
  }
}

export default new ImageGenerationService()

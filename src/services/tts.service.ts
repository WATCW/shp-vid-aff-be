import OpenAI from 'openai'
import { writeFileSync } from 'fs'
import { join } from 'path'
import logger from '@utils/logger'

class TTSService {
  private openai: OpenAI | null = null

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      logger.warn('[TTS] OpenAI API key not configured. Text-to-speech will be disabled.')
      return
    }

    this.openai = new OpenAI({ apiKey })
    logger.info('[TTS] ✅ TTS service initialized')
  }

  /**
   * Check if TTS is available
   */
  isAvailable(): boolean {
    return this.openai !== null
  }

  /**
   * Generate speech audio from text using OpenAI TTS
   * @param text - The text to convert to speech
   * @param outputPath - Path where audio file will be saved
   * @returns Path to the generated audio file
   */
  async generateSpeech(text: string, outputPath: string): Promise<string> {
    if (!this.openai) {
      throw new Error('TTS service is not available. OpenAI API key is not configured.')
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for TTS generation')
    }

    try {
      logger.info('[TTS] 🎤 Generating speech from text...')
      logger.info(`[TTS] Text length: ${text.length} characters`)

      // Call OpenAI TTS API
      const mp3 = await this.openai.audio.speech.create({
        model: 'tts-1', // Use tts-1 for faster, cheaper generation (tts-1-hd for higher quality)
        voice: 'nova', // Options: alloy, echo, fable, onyx, nova, shimmer
        input: text,
        speed: 1.0, // 0.25 to 4.0
      })

      // Convert response to buffer
      const buffer = Buffer.from(await mp3.arrayBuffer())

      // Save to file
      writeFileSync(outputPath, buffer)

      logger.info(`[TTS] ✅ Speech generated successfully: ${outputPath}`)
      logger.info(`[TTS] File size: ${(buffer.length / 1024).toFixed(2)} KB`)

      return outputPath
    } catch (error) {
      logger.error('[TTS] ❌ Error generating speech:', error)

      if (error instanceof Error) {
        // Check for specific OpenAI errors
        if (error.message.includes('API key')) {
          throw new Error('Invalid OpenAI API key')
        }
        if (error.message.includes('quota')) {
          throw new Error('OpenAI API quota exceeded')
        }
        throw new Error(`TTS generation failed: ${error.message}`)
      }

      throw new Error('TTS generation failed: Unknown error')
    }
  }

  /**
   * Generate speech with custom voice and speed
   */
  async generateSpeechCustom(
    text: string,
    outputPath: string,
    options?: {
      voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
      speed?: number
      model?: 'tts-1' | 'tts-1-hd'
    }
  ): Promise<string> {
    if (!this.openai) {
      throw new Error('TTS service is not available. OpenAI API key is not configured.')
    }

    try {
      const mp3 = await this.openai.audio.speech.create({
        model: options?.model || 'tts-1',
        voice: options?.voice || 'nova',
        input: text,
        speed: options?.speed || 1.0,
      })

      const buffer = Buffer.from(await mp3.arrayBuffer())
      writeFileSync(outputPath, buffer)

      logger.info(`[TTS] ✅ Custom speech generated: ${outputPath}`)
      return outputPath
    } catch (error) {
      logger.error('[TTS] ❌ Error generating custom speech:', error)
      throw error
    }
  }
}

export default new TTSService()

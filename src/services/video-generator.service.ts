import ffmpeg from 'fluent-ffmpeg'
import sharp from 'sharp'
import { existsSync, mkdirSync, unlinkSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import axios from 'axios'
import logger from '@utils/logger'
import Video, { IVideo } from '@models/video.model'
import Template, { ITemplate } from '@models/template.model'
import Music from '@models/music.model'
import Product from '@models/product.model'
import googleDriveService from './google-drive.service'

export interface VideoGenerationConfig {
  productId: string
  templateId?: string
  musicId?: string
  customText?: string[]
  enableVoiceNarration?: boolean
  narrationText?: string
}

export interface VideoScene {
  image: string
  text: string
  duration: number
  transition: string
}

export class VideoGeneratorService {
  private tempPath = join(process.cwd(), 'storage', 'temp')
  private videosPath = join(process.cwd(), 'storage', 'videos')
  private thumbnailsPath = join(process.cwd(), 'storage', 'thumbnails')

  constructor() {
    // Ensure directories exist
    [this.tempPath, this.videosPath, this.thumbnailsPath].forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    })
  }

  /**
   * Generate video for a product
   */
  async generateVideo(config: VideoGenerationConfig, progressCallback?: (progress: number) => void) {
    const startTime = Date.now()

    try {
      // Fetch product and validate
      // config.productId is Shopee productId (string), not MongoDB _id
      const product = await Product.findOne({ productId: config.productId })
      if (!product) {
        throw new Error(`Product not found: ${config.productId}`)
      }

      if (!product.aiContent) {
        throw new Error('Product does not have AI content generated')
      }

      // Fetch template
      let template: ITemplate | null = null
      if (config.templateId) {
        template = await Template.findById(config.templateId)
        if (!template) {
          throw new Error('Template not found')
        }
      } else {
        // Use default template
        template = await Template.findOne({ name: 'Modern Minimal' })
        if (!template) {
          throw new Error('Default template not found')
        }
      }

      // Create video record
      const videoId = nanoid()
      const video = new Video({
        productId: product._id,
        templateId: template._id,
        videoConfig: {
          template: template.name,
          duration: template.config.videoSettings.duration,
          resolution: `${template.config.videoSettings.resolution.width}x${template.config.videoSettings.resolution.height}`,
          fps: template.config.videoSettings.fps,
          music: config.musicId,
        },
        content: {
          caption: product.aiContent.caption,
          hashtags: product.aiContent.hashtags || [],
          overlayText: config.customText || product.aiContent.keyPoints || [],
        },
        assets: {
          images: product.images || [],
          music: config.musicId,
        },
        status: 'processing',
        progress: 0,
      })

      await video.save()

      // Update progress
      if (progressCallback) progressCallback(10)

      // Prepare scenes
      const scenes = await this.prepareScenes(product, template, config.customText)
      if (progressCallback) progressCallback(30)

      // Process images and create video scenes
      const processedScenes = await this.processScenes(scenes, template)
      if (progressCallback) progressCallback(50)

      // Generate TTS audio if enabled
      let narrationAudioPath: string | undefined
      if (config.enableVoiceNarration && config.narrationText) {
        logger.info('[VIDEO-GEN] 🎤 Generating voice narration...')
        const { default: ttsService } = await import('./tts.service')

        if (ttsService.isAvailable()) {
          narrationAudioPath = join(this.tempPath, `${videoId}_narration.mp3`)
          try {
            await ttsService.generateSpeech(config.narrationText, narrationAudioPath)
            logger.info('[VIDEO-GEN] ✅ Voice narration generated')
          } catch (error) {
            logger.error('[VIDEO-GEN] ❌ Failed to generate voice narration:', error)
            // Continue without narration if TTS fails
            narrationAudioPath = undefined
          }
        } else {
          logger.warn('[VIDEO-GEN] ⚠️  TTS service not available, skipping voice narration')
        }
      }

      // Generate video
      const videoPath = await this.createVideoFromScenes(
        processedScenes,
        template,
        videoId,
        config.musicId,
        narrationAudioPath,
        (progress) => {
          if (progressCallback) progressCallback(50 + progress * 0.4)
        }
      )

      if (progressCallback) progressCallback(90)

      // Generate thumbnail
      const thumbnailPath = await this.generateThumbnail(videoPath, videoId)
      if (progressCallback) progressCallback(95)

      // Get file size
      const { size } = await import('fs/promises').then((fs) => fs.stat(videoPath))

      // Upload to Google Drive if enabled, otherwise use local storage
      let finalVideoPath: string
      let finalThumbnailPath: string
      let googleDriveVideoId: string | undefined
      let googleDriveThumbnailId: string | undefined

      if (googleDriveService.isEnabled()) {
        logger.info('[VIDEO-GEN] ☁️  Uploading video to Google Drive...')

        // Upload video
        const videoBuffer = readFileSync(videoPath)
        const videoResult = await googleDriveService.uploadFile(
          videoBuffer,
          `${videoId}.mp4`,
          'video/mp4'
        )
        finalVideoPath = videoResult.directUrl
        googleDriveVideoId = videoResult.fileId

        // Upload thumbnail
        const thumbnailBuffer = readFileSync(thumbnailPath)
        const thumbnailResult = await googleDriveService.uploadFile(
          thumbnailBuffer,
          `${videoId}.jpg`,
          'image/jpeg'
        )
        finalThumbnailPath = thumbnailResult.directUrl
        googleDriveThumbnailId = thumbnailResult.fileId

        logger.info('[VIDEO-GEN] ✅ Uploaded to Google Drive')

        // Clean up local files
        unlinkSync(videoPath)
        unlinkSync(thumbnailPath)
      } else {
        logger.info('[VIDEO-GEN] 💾 Using local storage')

        // Convert absolute paths to relative URLs for serving via static plugin
        finalVideoPath = videoPath.replace(process.cwd(), '').replace(/\\/g, '/')
        finalThumbnailPath = thumbnailPath.replace(process.cwd(), '').replace(/\\/g, '/')
      }

      // Update video record
      video.output = {
        filePath: finalVideoPath,
        fileName: `${videoId}.mp4`,
        fileSize: size,
        thumbnailPath: finalThumbnailPath,
        googleDriveFileId: googleDriveVideoId,
        googleDriveThumbnailId: googleDriveThumbnailId,
      }
      video.status = 'completed'
      video.progress = 100
      video.renderTime = Date.now() - startTime
      video.completedAt = new Date()

      await video.save()

      // Increment template usage
      if (template) {
        await Template.findByIdAndUpdate(template._id, { $inc: { usageCount: 1 } })
      }

      // Increment music usage
      if (config.musicId) {
        await Music.findByIdAndUpdate(config.musicId, { $inc: { usageCount: 1 } })
      }

      if (progressCallback) progressCallback(100)

      logger.info(`Video generated successfully: ${videoId} in ${Date.now() - startTime}ms`)

      return video
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined

      logger.error('Error generating video:')
      logger.error(`Message: ${errorMessage}`)
      if (errorStack) {
        logger.error(`Stack: ${errorStack}`)
      }

      throw error
    }
  }

  /**
   * Prepare video scenes from product data
   */
  private async prepareScenes(
    product: any,
    template: ITemplate,
    customText?: string[]
  ): Promise<VideoScene[]> {
    const scenes: VideoScene[] = []

    // Collect all available images (scraped + fallback)
    const images: string[] = []
    if (product.images && product.images.length > 0) {
      images.push(...product.images)
    }
    if (product.fallbackImages?.images && product.fallbackImages.images.length > 0) {
      images.push(...product.fallbackImages.images)
    }

    const textSlides = customText || product.aiContent?.keyPoints || []
    const sceneDuration = template.config.imageEffects.displayTime

    logger.info('[VIDEO-GEN] Preparing scenes:', {
      productId: product.productId,
      scrapedImagesCount: product.images?.length || 0,
      fallbackImagesCount: product.fallbackImages?.images?.length || 0,
      totalImagesCount: images.length,
      textSlidesCount: textSlides.length,
      firstImage: images[0],
    })

    // Validate we have images
    if (images.length === 0) {
      throw new Error('Product has no images. Cannot generate video.')
    }

    // Calculate minimum scenes needed for at least 10 seconds video
    const minDuration = 10 // minimum 10 seconds
    const minScenes = Math.ceil(minDuration / sceneDuration)

    // Determine target scene count (at least minScenes, prefer matching text slides)
    const targetScenes = Math.max(minScenes, textSlides.length)

    logger.info(`[VIDEO-GEN] Target scenes: ${targetScenes} (min ${minScenes} for ${minDuration}s video)`)

    // Create scenes - repeat images if necessary to reach target duration
    for (let i = 0; i < targetScenes; i++) {
      const imageIndex = i % images.length // Cycle through available images
      const textIndex = i < textSlides.length ? i : -1 // Use text if available

      scenes.push({
        image: images[imageIndex],
        text: textIndex >= 0 ? textSlides[textIndex] : '',
        duration: sceneDuration,
        transition: template.config.imageEffects.transition,
      })
    }

    const totalDuration = scenes.length * sceneDuration
    logger.info(`[VIDEO-GEN] Created ${scenes.length} scenes, total duration: ${totalDuration}s`)

    return scenes
  }

  /**
   * Download image from URL to Buffer
   */
  private async downloadImageToBuffer(url: string): Promise<Buffer> {
    try {
      logger.info(`[VIDEO-GEN] Downloading image from URL: ${url.substring(0, 100)}...`)
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      })
      const buffer = Buffer.from(response.data)
      logger.info(`[VIDEO-GEN] Successfully downloaded ${buffer.length} bytes`)
      return buffer
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`[VIDEO-GEN] Failed to download image from URL: ${url}`)
      logger.error(`[VIDEO-GEN] Error: ${errorMessage}`)
      throw new Error(`Failed to download image from URL: ${errorMessage}`)
    }
  }

  /**
   * Convert image URL to local file path
   */
  private resolveImagePath(imagePath: string): string {
    // If it starts with /app/storage (production path), convert to local path
    if (imagePath.startsWith('/app/storage')) {
      return join(process.cwd(), 'storage', imagePath.replace('/app/storage/', ''))
    }

    // If it starts with /storage, prepend process.cwd() only
    if (imagePath.startsWith('/storage')) {
      return join(process.cwd(), imagePath.replace(/^\//, ''))
    }

    // If it starts with /uploads, prepend storage directory
    if (imagePath.startsWith('/uploads')) {
      return join(process.cwd(), 'storage', imagePath.replace(/^\//, ''))
    }

    // Otherwise assume it's already a full path or URL
    return imagePath
  }

  /**
   * Process scenes with image effects and text overlays
   */
  private async processScenes(
    scenes: VideoScene[],
    template: ITemplate
  ): Promise<string[]> {
    const processedPaths: string[] = []
    const { resolution } = template.config.videoSettings
    const { filter } = template.config.imageEffects

    logger.info('[VIDEO-GEN] Processing scenes:', {
      sceneCount: scenes.length,
      resolution: `${resolution.width}x${resolution.height}`,
      filter,
    })

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const outputPath = join(this.tempPath, `scene-${i}-${nanoid()}.png`)

      // Resolve image path (convert URL paths to local file paths)
      const resolvedImagePath = this.resolveImagePath(scene.image)

      logger.info(`[VIDEO-GEN] Processing scene ${i + 1}/${scenes.length}:`, {
        imageSource: scene.image?.substring(0, 100) || 'no-image',
        resolvedPath: resolvedImagePath?.substring(0, 100) || 'no-path',
        text: scene.text?.substring(0, 50) || 'no-text',
      })

      try {
        let imageProcessor: sharp.Sharp

        // Check if the image is a URL that needs to be downloaded
        if (resolvedImagePath.startsWith('http://') || resolvedImagePath.startsWith('https://')) {
          // Download the image to a Buffer first
          const imageBuffer = await this.downloadImageToBuffer(resolvedImagePath)
          imageProcessor = sharp(imageBuffer)
        } else {
          // Use local file path
          imageProcessor = sharp(resolvedImagePath)
        }

        // Resize and process
        imageProcessor = imageProcessor.resize(resolution.width, resolution.height, {
          fit: 'cover',
          position: 'center',
        })

        // Apply filter
        if (filter && filter !== 'none') {
          imageProcessor = this.applyImageFilter(imageProcessor, filter)
        }

        await imageProcessor.toFile(outputPath)

        logger.info(`[VIDEO-GEN] Scene ${i + 1} processed successfully: ${outputPath}`)
        processedPaths.push(outputPath)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`[VIDEO-GEN] Error processing scene ${i}:`)
        logger.error(`Scene image: ${scene.image}`)
        logger.error(`Error message: ${errorMessage}`)
        if (error instanceof Error && error.stack) {
          logger.error(`Stack: ${error.stack}`)
        }
        throw new Error(`Failed to process scene ${i}: ${errorMessage}`)
      }
    }

    logger.info(`[VIDEO-GEN] All ${processedPaths.length} scenes processed successfully`)
    return processedPaths
  }

  /**
   * Apply image filter
   */
  private applyImageFilter(processor: sharp.Sharp, filter: string): sharp.Sharp {
    switch (filter) {
      case 'vintage':
        return processor.modulate({ saturation: 0.7, brightness: 0.9 }).tint({ r: 255, g: 240, b: 220 })
      case 'vivid':
        return processor.modulate({ saturation: 1.3, brightness: 1.1 })
      case 'warm':
        return processor.tint({ r: 255, g: 245, b: 235 })
      case 'cool':
        return processor.tint({ r: 235, g: 245, b: 255 })
      default:
        return processor
    }
  }

  /**
   * Create video from processed scenes using FFmpeg
   */
  private async createVideoFromScenes(
    scenePaths: string[],
    template: ITemplate,
    videoId: string,
    musicId?: string,
    narrationAudioPath?: string,
    progressCallback?: (progress: number) => void
  ): Promise<string> {
    const outputPath = join(this.videosPath, `${videoId}.mp4`)
    const { resolution, fps } = template.config.videoSettings
    const sceneDuration = template.config.imageEffects.displayTime

    // Create input file list for FFmpeg
    const inputListPath = join(this.tempPath, `input-${videoId}.txt`)

    logger.info('[VIDEO-GEN] Creating FFmpeg input list:', {
      inputListPath,
      sceneCount: scenePaths.length,
      sceneDuration,
      firstScene: scenePaths[0],
    })

    // Validate we have scenes
    if (scenePaths.length === 0) {
      throw new Error('No processed scenes available. Cannot create video.')
    }

    const inputListContent = scenePaths
      .map((path) => `file '${path}'\nduration ${sceneDuration}`)
      .join('\n')

    logger.info('[VIDEO-GEN] Input file content preview:', inputListContent.substring(0, 200))

    writeFileSync(inputListPath, inputListContent)

    // Verify file was written
    if (!existsSync(inputListPath)) {
      throw new Error(`Failed to create input list file at: ${inputListPath}`)
    }

    logger.info('[VIDEO-GEN] Input list file created successfully')

    return new Promise((resolve, reject) => {
      let command = ffmpeg()
        .input(inputListPath)
        .inputOptions([
          '-f concat',
          '-safe 0',
          '-threads 1', // Limit threads to reduce memory usage
        ])
        .outputOptions([
          `-vf scale=${resolution.width}:${resolution.height}`,
          `-r ${fps}`,
          '-pix_fmt yuv420p',
          '-c:v libx264',
          '-preset ultrafast', // Changed from 'medium' to 'ultrafast' for less memory
          '-crf 28', // Increased from 23 to 28 for smaller file size and less memory
          '-movflags +faststart',
          '-max_muxing_queue_size 1024', // Prevent memory overflow
        ])

      // Handle audio inputs (music and/or narration)
      const hasMusic = !!musicId
      const hasNarration = !!narrationAudioPath && existsSync(narrationAudioPath)

      if (hasMusic && hasNarration) {
        // Both music and narration - mix them together
        Music.findById(musicId).then((music) => {
          if (music && existsSync(music.filePath)) {
            command = command
              .input(music.filePath) // Background music
              .input(narrationAudioPath!) // Voice narration
              .complexFilter([
                // Lower music volume and mix with narration
                '[1:a]volume=0.3[music]', // Music at 30% volume
                '[2:a]volume=1.0[narration]', // Narration at 100% volume
                '[music][narration]amix=inputs=2:duration=first[aout]', // Mix both
              ])
              .outputOptions([
                '-map 0:v', // Video from first input
                '-map [aout]', // Mixed audio
                '-c:v libx264',
                '-c:a aac',
                '-b:a 128k',
                '-shortest',
              ])
          }
        })
      } else if (hasMusic) {
        // Only music
        Music.findById(musicId).then((music) => {
          if (music && existsSync(music.filePath)) {
            command = command
              .input(music.filePath)
              .outputOptions([
                '-c:a aac',
                '-b:a 128k',
                '-shortest',
              ])
          }
        })
      } else if (hasNarration) {
        // Only narration
        command = command
          .input(narrationAudioPath)
          .outputOptions([
            '-c:a aac',
            '-b:a 128k',
            '-shortest',
          ])
      }

      command
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.info('FFmpeg process started:', commandLine)
        })
        .on('progress', (progress) => {
          if (progressCallback && progress.percent) {
            progressCallback(progress.percent / 100)
          }
        })
        .on('end', () => {
          // Cleanup temp files
          scenePaths.forEach((path) => {
            try {
              if (existsSync(path)) unlinkSync(path)
            } catch (err) {
              logger.warn(`Failed to delete temp file: ${path}`)
            }
          })

          try {
            if (existsSync(inputListPath)) unlinkSync(inputListPath)
          } catch (err) {
            logger.warn(`Failed to delete input list: ${inputListPath}`)
          }

          // Cleanup narration audio file
          if (narrationAudioPath && existsSync(narrationAudioPath)) {
            try {
              unlinkSync(narrationAudioPath)
              logger.info('[VIDEO-GEN] Cleaned up narration audio file')
            } catch (err) {
              logger.warn(`Failed to delete narration audio: ${narrationAudioPath}`)
            }
          }

          resolve(outputPath)
        })
        .on('error', (err) => {
          const errorMessage = err instanceof Error ? err.message : String(err)
          logger.error('FFmpeg error:')
          logger.error(`Message: ${errorMessage}`)
          if (err instanceof Error && err.stack) {
            logger.error(`Stack: ${err.stack}`)
          }
          reject(err)
        })
        .run()
    })
  }

  /**
   * Generate thumbnail from video
   */
  private async generateThumbnail(videoPath: string, videoId: string): Promise<string> {
    const thumbnailPath = join(this.thumbnailsPath, `${videoId}.jpg`)

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: ['00:00:01'],
          filename: `${videoId}.jpg`,
          folder: this.thumbnailsPath,
          size: '1080x1920',
        })
        .on('end', () => {
          resolve(thumbnailPath)
        })
        .on('error', (err) => {
          const errorMessage = err instanceof Error ? err.message : String(err)
          logger.error('Error generating thumbnail:')
          logger.error(`Message: ${errorMessage}`)
          if (err instanceof Error && err.stack) {
            logger.error(`Stack: ${err.stack}`)
          }
          reject(err)
        })
    })
  }

  /**
   * Get video by ID
   */
  async getVideoById(id: string) {
    try {
      const video = await Video.findById(id)
        .populate('productId')
        .populate('templateId')
        .lean()

      if (!video) {
        throw new Error('Video not found')
      }

      return video
    } catch (error) {
      logger.error('Error getting video by ID:', error)
      throw error
    }
  }

  /**
   * Get videos by product ID
   */
  async getVideosByProductId(productId: string) {
    try {
      const videos = await Video.find({ productId })
        .populate('templateId')
        .sort({ createdAt: -1 })
        .lean()

      return videos
    } catch (error) {
      logger.error('Error getting videos by product ID:', error)
      throw new Error('Failed to fetch videos')
    }
  }

  /**
   * Delete video
   */
  async deleteVideo(id: string) {
    try {
      const video = await Video.findById(id)

      if (!video) {
        throw new Error('Video not found')
      }

      // Delete video file
      if (video.output?.filePath && existsSync(video.output.filePath)) {
        unlinkSync(video.output.filePath)
      }

      // Delete thumbnail
      if (video.output?.thumbnailPath && existsSync(video.output.thumbnailPath)) {
        unlinkSync(video.output.thumbnailPath)
      }

      // Delete database record
      await Video.findByIdAndDelete(id)

      logger.info(`Video deleted: ${id}`)

      return { success: true }
    } catch (error) {
      logger.error('Error deleting video:', error)
      throw error
    }
  }
}

export default new VideoGeneratorService()
